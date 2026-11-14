const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../utils/jwt');
const { generateReferralCode } = require('../utils/generators');
const { phoneCandidates, normalizePhoneForStorage, isPendingPhone } = require('../utils/phone');
const { sendSms, isSmsConfigured } = require('../integrations/sms');
const {
  RESET_TTL_MINUTES,
  generateCode,
  issueResetToken,
  issueDecoyToken,
  verifyResetToken,
  isResetValid,
  tooManyAttempts,
  recordFailure,
  clearFailures,
} = require('../utils/passwordReset');

const PHONE_PENDING_PREFIX = 'google-pending-';
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

function sanitizeUser(user) {
  const { password, ...rest } = user;
  return {
    ...rest,
    // Les comptes crees via Google n'ont pas de mot de passe tant que le client n'en definit pas un.
    hasPassword: !!password,
    needsProfileCompletion: rest.phone?.startsWith(PHONE_PENDING_PREFIX) || false,
  };
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
    where: { OR: [{ phone: { in: phoneCandidates(phone) } }, ...(email ? [{ email }] : [])] },
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
      phone: normalizePhoneForStorage(phone),
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
    where: { OR: [{ phone: { in: phoneCandidates(phone) } }, { email: phone }] },
    include: { customerProfile: true, driverProfile: true },
  });
  if (!user) throw new ApiError(401, 'Identifiants incorrects');
  if (!user.isActive) throw new ApiError(403, 'Ce compte a ete desactive');
  if (!user.password) {
    throw new ApiError(400, "Ce compte utilise la connexion Google. Utilisez le bouton \"Continuer avec Google\".");
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new ApiError(401, 'Identifiants incorrects');

  res.json(buildAuthResponse(user));
});

// POST /api/auth/google - connexion/inscription via Google Identity Services.
// Le frontend envoie le "credential" (ID token JWT) recu du bouton Google ;
// on le verifie aupres de Google avant de faire confiance a son contenu.
// Necessite GOOGLE_CLIENT_ID (voir .env.example) - sans cette variable,
// la route repond explicitement que la fonctionnalite n'est pas configuree
// plutot que d'echouer silencieusement.
const googleAuth = asyncHandler(async (req, res) => {
  const { credential } = req.body;
  if (!credential) throw new ApiError(400, 'Jeton Google manquant');
  if (!googleClient) throw new ApiError(503, "La connexion Google n'est pas configuree sur ce serveur (GOOGLE_CLIENT_ID manquant)");

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (err) {
    throw new ApiError(401, 'Jeton Google invalide ou expire');
  }

  const { sub: googleId, email, given_name: firstName, family_name: lastName } = payload;
  if (!email) throw new ApiError(400, "Ce compte Google ne fournit pas d'adresse email");

  const include = { customerProfile: true, driverProfile: true };
  let user = await prisma.user.findFirst({ where: { OR: [{ googleId }, { email }] }, include });

  if (user) {
    if (!user.isActive) throw new ApiError(403, 'Ce compte a ete desactive');
    if (!user.googleId) {
      // Compte existant (cree via telephone/mot de passe) avec le meme email -> on relie Google.
      user = await prisma.user.update({ where: { id: user.id }, data: { googleId }, include });
    }
  } else {
    const myReferralCode = await uniqueReferralCode(firstName || 'ami');
    // Google ne fournit pas de numero de telephone (indispensable partout
    // ailleurs dans l'appli pour la livraison). On cree un marqueur temporaire
    // et needsProfileCompletion (voir sanitizeUser) indique au frontend qu'il
    // doit inviter le client a renseigner son vrai numero.
    user = await prisma.user.create({
      data: {
        firstName: firstName || 'Client',
        lastName: lastName || '',
        phone: `${PHONE_PENDING_PREFIX}${googleId}`,
        email,
        googleId,
        role: 'CUSTOMER',
        customerProfile: { create: { referralCode: myReferralCode } },
      },
      include,
    });
  }

  res.json(buildAuthResponse(user));
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  res.json(sanitizeUser(req.user));
});

// PATCH /api/auth/me - modifier son profil (section 11 : "modifier son profil")
const updateMe = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, email } = req.body;
  const data = {};

  if (firstName) data.firstName = firstName;
  if (lastName) data.lastName = lastName;
  if (email !== undefined) data.email = email || null;

  if (phone) {
    const clash = await prisma.user.findFirst({ where: { phone: { in: phoneCandidates(phone) }, NOT: { id: req.user.id } } });
    if (clash) throw new ApiError(409, 'Ce numero de telephone est deja utilise par un autre compte');
    data.phone = normalizePhoneForStorage(phone);
  }

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data,
    include: { customerProfile: true, driverProfile: true },
  });

  res.json(sanitizeUser(updated));
});

// PATCH /api/auth/me/password - changer son mot de passe
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) throw new ApiError(400, 'Le nouveau mot de passe doit contenir au moins 6 caracteres');

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  if (user.password) {
    const valid = currentPassword && (await bcrypt.compare(currentPassword, user.password));
    if (!valid) throw new ApiError(401, 'Mot de passe actuel incorrect');
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });
  res.json({ message: 'Mot de passe mis a jour' });
});

// DELETE /api/auth/me - suppression du compte par le client (exigence Google Play : suppression depuis l'application).
// Les donnees personnelles sont effacees ou rendues anonymes ; les commandes passees sont conservees sans lien avec
// la personne (obligations comptables). Refus tant qu'une commande est en cours.
// Corps : { password } pour un compte avec mot de passe, { confirm: "SUPPRIMER" } pour un compte Google.
const deleteMe = asyncHandler(async (req, res) => {
  if (req.user.role !== 'CUSTOMER' || !req.customerProfile) {
    throw new ApiError(403, 'La suppression du compte est reservee aux clients. Contactez l\'administration.');
  }
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const { password, confirm } = req.body || {};

  if (user.password) {
    const valid = password && (await bcrypt.compare(String(password), user.password));
    if (!valid) throw new ApiError(401, 'Mot de passe incorrect');
  } else if (String(confirm || '').trim().toUpperCase() !== 'SUPPRIMER') {
    throw new ApiError(400, 'Tapez SUPPRIMER pour confirmer');
  }

  const customerId = req.customerProfile.id;
  const pending = await prisma.order.count({ where: { customerId, status: { notIn: ['DELIVERED', 'CANCELLED'] } } });
  if (pending > 0) {
    throw new ApiError(400, 'Vous avez une commande en cours : attendez sa livraison ou annulez-la avant de supprimer votre compte.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.deviceToken.deleteMany({ where: { userId: user.id } });
    await tx.notification.deleteMany({ where: { userId: user.id } });
    await tx.favorite.deleteMany({ where: { customerId } });
    await tx.recurringOrder.deleteMany({ where: { customerId } });
    await tx.customerProductPrice.deleteMany({ where: { customerId } });
    await tx.cart.deleteMany({ where: { customerId } });
    // Adresses : supprimees, ou vidées si une commande passee s'y rapporte.
    await tx.address.deleteMany({ where: { customerId, orders: { none: {} } } });
    await tx.address.updateMany({
      where: { customerId },
      data: { fullName: 'Compte supprime', phone: '000000000', landmark: null, instructions: null, latitude: null, longitude: null, isDefault: false },
    });
    await tx.review.updateMany({ where: { customerId }, data: { comment: null } });
    await tx.customerProfile.update({
      where: { id: customerId },
      data: { loyaltyPoints: 0, businessName: null, taxId: null, professionalStatus: 'NONE', wholesaleDiscountPercent: 0, customerType: 'PARTICULIER' },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { firstName: 'Compte', lastName: 'supprime', phone: `deleted-${user.id}`, email: null, password: null, googleId: null, isActive: false },
    });
  });

  res.json({ message: 'Votre compte a ete supprime.' });
});

// POST /api/auth/forgot-password - envoie un code a 6 chiffres par SMS au numero
// du compte client. La reponse est la meme que le compte existe ou non (pas
// d'enumeration de comptes) ; voir utils/passwordReset.js pour le principe.
const forgotPassword = asyncHandler(async (req, res) => {
  const identifier = String(req.body.identifier || '').trim();

  const user = await prisma.user.findFirst({
    where: {
      role: 'CUSTOMER',
      isActive: true,
      OR: [{ phone: { in: phoneCandidates(identifier) } }, { email: { equals: identifier, mode: 'insensitive' } }],
    },
  });

  let resetToken;
  if (user && !isPendingPhone(user.phone)) {
    const code = generateCode();
    resetToken = issueResetToken(user, code);
    await sendSms(
      user.phone,
      `Fresh Fish : votre code de reinitialisation est ${code}. Il expire dans ${RESET_TTL_MINUTES} minutes. Ne le communiquez a personne.`
    ).catch((err) => console.error('[auth:reset-sms]', err.message));
  } else {
    resetToken = issueDecoyToken();
  }

  res.json({
    resetToken,
    expiresInMinutes: RESET_TTL_MINUTES,
    smsAvailable: isSmsConfigured(),
    message: 'Si un compte correspond, un code de verification vient d\'etre envoye par SMS.',
  });
});

// POST /api/auth/reset-password - verifie le code, change le mot de passe et
// connecte directement le client.
const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, code, newPassword } = req.body;
  const invalid = () => new ApiError(400, 'Code invalide ou expire. Demandez un nouveau code.');

  let payload;
  try {
    payload = verifyResetToken(resetToken);
  } catch (err) {
    throw invalid();
  }
  if (tooManyAttempts(payload.sub)) throw new ApiError(429, 'Trop de tentatives. Reessayez dans quelques minutes.');

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { customerProfile: true, driverProfile: true },
  });
  const allowed = !!user && user.role === 'CUSTOMER' && user.isActive;
  if (!allowed || !isResetValid(payload, user, code)) {
    recordFailure(payload.sub);
    throw invalid();
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
    include: { customerProfile: true, driverProfile: true },
  });
  clearFailures(payload.sub);

  res.json(buildAuthResponse(updated));
});

module.exports = { register, login, googleAuth, me, updateMe, changePassword, deleteMe, forgotPassword, resetPassword };
