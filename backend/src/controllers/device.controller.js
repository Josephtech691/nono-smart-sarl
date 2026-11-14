const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// POST /api/devices - enregistre le telephone de l'utilisateur connecte pour les notifications push.
// Un telephone appartient a un seul compte a la fois : si quelqu'un d'autre se connecte dessus, il lui est reattribue.
const registerDevice = asyncHandler(async (req, res) => {
  const { token, platform = 'android' } = req.body || {};
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) throw new ApiError(400, 'Jeton invalide');
  await prisma.deviceToken.upsert({
    where: { token },
    update: { userId: req.user.id, platform: String(platform).slice(0, 20) },
    create: { token, userId: req.user.id, platform: String(platform).slice(0, 20) },
  });
  res.status(204).end();
});

// DELETE /api/devices - a la deconnexion : ce telephone ne recoit plus les notifications de ce compte.
const unregisterDevice = asyncHandler(async (req, res) => {
  const token = req.body?.token || req.query?.token;
  if (typeof token === 'string' && token) {
    await prisma.deviceToken.deleteMany({ where: { token, userId: req.user.id } });
  }
  res.status(204).end();
});

module.exports = { registerDevice, unregisterDevice };
