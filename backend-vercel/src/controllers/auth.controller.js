const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../utils/jwt');
const { generateReferralCode } = require('../utils/generators');

function sanitizeUser(user) {
  const { password, ...rest } = user;
  return rest;
}

function buildAuthResponse(user) {
  const token = signToken({ sub: user.id, role: user.role });
  return { token, user: sanitizeUser(user) };
}

// Genere un code de parrainage unique (retente en cas de collision improbable).
async function uniqueReferralCode(firstName) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode(firstName);
    const clash = await prisma.customerProfile.findUnique({ where: { referralCode: code } });
    if (!clash) return code;
  }
  return `${generateReferralCode(firstName)}${Date.now().toString().slice(-3)}`;
}

// POST /api/auth/register - inscription client (section 11)
const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, email, password, referralCode } = req.body;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ phone }, ...(email ? [{ email }] : [])] },
  });
  if (existing) throw new ApiError(409, 'Un compte existe deja avec ce telephone ou cet email');

  let referrer = null;
  if (referralCode) {
    referrer = await prisma.customerProfile.findUnique({ where: { referralCode: referralCode.trim().toUpperCase() } });
  }

  const hashed = await bcrypt.hash(password, 10);
  const myReferralCode = await uniqueReferralCode(firstName);

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      phone,
      email: email || null,
      password: hashed,
      role: 'CUSTOMER',
      customerProfile: {
        create: { referralCode: myReferralCode, referredById: referrer?.id },
      },
    },
    include: { customerProfile: true },
  });

  res.status(201).json(buildAuthResponse(user));
});

// POST /api/auth/login - utilise par clients, admin et livreurs (le role
// determine le routage cote frontend)
const login = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;

  const user = await prisma.user.findFirst({
    where: { OR: [{ phone }, { email: phone }] },
    include: { customerProfile: true, driverProfile: true },
  });
  if (!user) throw new ApiError(401, 'Identifiants incorrects');
  if (!user.isActive) throw new ApiError(403, 'Ce compte a ete desactive');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new ApiError(401, 'Identifiants incorrects');

  res.json(buildAuthResponse(user));
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  res.json(sanitizeUser(req.user));
});

module.exports = { register, login, me };
