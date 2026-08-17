const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/notifications (mine, filtrees par audience selon le role)
const listMyNotifications = asyncHandler(async (req, res) => {
  const audience = req.user.role; // CUSTOMER | ADMIN | DRIVER (memes valeurs que l'enum)
  const notifications = await prisma.notification.findMany({
    where: {
      OR: [{ userId: req.user.id }, { audience, userId: null }],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifications);
});

const markRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const notification = await prisma.notification.update({ where: { id }, data: { isRead: true } });
  res.json(notification);
});

const markAllRead = asyncHandler(async (req, res) => {
  const audience = req.user.role;
  await prisma.notification.updateMany({
    where: { OR: [{ userId: req.user.id }, { audience, userId: null }], isRead: false },
    data: { isRead: true },
  });
  res.json({ message: 'Notifications marquees comme lues' });
});

module.exports = { listMyNotifications, markRead, markAllRead };
