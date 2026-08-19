const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../utils/jwt');

// Verifie le JWT et attache req.user (+ profil client/livreur selon le role).
// Rejette si le token est absent/invalide, ou si le compte a ete desactive.
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) throw new ApiError(401, 'Authentification requise');

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    throw new ApiError(401, 'Session invalide ou expiree, veuillez vous reconnecter');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { customerProfile: true, driverProfile: true },
  });

  if (!user || !user.isActive) throw new ApiError(401, 'Compte introuvable ou desactive');

  req.user = user;
  req.customerProfile = user.customerProfile || null;
  req.driverProfile = user.driverProfile || null;
  next();
});

// Authentification optionnelle : utilisee sur des routes accessibles aussi
// aux invites (ex: creation de commande). Si un token valide est fourni, on
// attache l'utilisateur ; sinon on continue sans bloquer.
const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { customerProfile: true, driverProfile: true },
    });
    if (user && user.isActive) {
      req.user = user;
      req.customerProfile = user.customerProfile || null;
      req.driverProfile = user.driverProfile || null;
    }
  } catch (err) {
    // token invalide sur une route optionnelle : on ignore simplement
  }
  next();
});

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    throw new ApiError(403, "Vous n'avez pas les droits pour effectuer cette action");
  }
  next();
};

module.exports = { requireAuth, optionalAuth, requireRole };
