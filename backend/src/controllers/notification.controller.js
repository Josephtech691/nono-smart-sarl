const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// Notifications visibles pour un utilisateur : les siennes et, pour l'administration seulement,
// celles adressees a tous les administrateurs. Un client ou un livreur ne voit jamais une
// notification sans destinataire (elle serait celle d'un autre).
const visibleTo = (user) => (user.role === 'ADMIN' ? [{ userId: user.id }, { audience: 'ADMIN', userId: null }] : [{ userId: user.id }]);

// GET /api/notifications?limit=50 -> { items, unreadCount }
const listMyNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const where = { OR: visibleTo(req.user) };
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit }),
    prisma.notification.count({ where: { ...where, isRead: false } }),
  ]);
  res.json({ items, unreadCount });
});

const markRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Une notification ne peut etre marquee lue que par son destinataire.
  const { count } = await prisma.notification.updateMany({
    where: { id, OR: visibleTo(req.user) },
    data: { isRead: true },
  });
  if (!count) throw new ApiError(404, 'Notification introuvable');
  res.json({ id, isRead: true });
});

const markAllRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { OR: visibleTo(req.user), isRead: false },
    data: { isRead: true },
  });
  res.json({ message: 'Notifications marquees comme lues' });
});

module.exports = { listMyNotifications, markRead, markAllRead };
