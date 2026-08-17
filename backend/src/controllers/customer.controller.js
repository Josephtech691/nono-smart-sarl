const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notify, notifyAdmins } = require('../utils/notify');

// GET /api/customers (admin) - section 4.2 "Clients" du dashboard
const listCustomers = asyncHandler(async (req, res) => {
  const { search, professionalStatus, page = '1', limit = '30' } = req.query;
  const take = Math.min(Number(limit) || 30, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const where = {
    ...(professionalStatus ? { professionalStatus } : {}),
    ...(search
      ? {
          user: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.customerProfile.findMany({
      where,
      include: { user: true, _count: { select: { orders: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.customerProfile.count({ where }),
  ]);

  res.json({ items, total, page: Number(page) || 1, limit: take });
});

// GET /api/customers/:id (admin)
const getCustomer = asyncHandler(async (req, res) => {
  const customer = await prisma.customerProfile.findUnique({
    where: { id: req.params.id },
    include: {
      user: true,
      addresses: true,
      orders: { orderBy: { createdAt: 'desc' }, take: 10, include: { items: true } },
    },
  });
  if (!customer) throw new ApiError(404, 'Client introuvable');
  res.json(customer);
});

// PATCH /api/customers/me/professional-request (client) - section 47
const requestProfessionalStatus = asyncHandler(async (req, res) => {
  const { businessName, taxId } = req.body;
  if (!businessName) throw new ApiError(400, "Le nom de l'entreprise est requis");

  const updated = await prisma.customerProfile.update({
    where: { id: req.customerProfile.id },
    data: { businessName, taxId, professionalStatus: 'PENDING' },
  });

  await notifyAdmins({
    title: 'Demande de compte professionnel',
    message: `${req.user.firstName} ${req.user.lastName} (${businessName}) demande un statut professionnel`,
    link: `/admin/clients`,
  });

  res.json(updated);
});

// PATCH /api/customers/:id/professional-status (admin)
const updateProfessionalStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, wholesaleDiscountPercent } = req.body;
  if (!['APPROVED', 'REJECTED', 'NONE'].includes(status)) throw new ApiError(400, 'Statut invalide');

  const customer = await prisma.customerProfile.findUnique({ where: { id }, include: { user: true } });
  if (!customer) throw new ApiError(404, 'Client introuvable');

  const updated = await prisma.customerProfile.update({
    where: { id },
    data: {
      professionalStatus: status,
      customerType: status === 'APPROVED' ? 'PROFESSIONNEL' : 'PARTICULIER',
      wholesaleDiscountPercent: status === 'APPROVED' ? Number(wholesaleDiscountPercent) || 0 : 0,
    },
  });

  await notify({
    userId: customer.userId,
    audience: 'CUSTOMER',
    title: status === 'APPROVED' ? 'Compte professionnel approuvé' : 'Demande professionnelle refusée',
    message:
      status === 'APPROVED'
        ? `Votre compte professionnel a été approuvé avec une remise grossiste de ${wholesaleDiscountPercent || 0}%.`
        : "Votre demande de compte professionnel n'a pas été approuvée. Contactez-nous pour plus d'informations.",
    link: '/compte/profil',
    phone: customer.user.phone,
    sms: true,
  });

  res.json(updated);
});

// GET /api/customers/me/referral (client) - section 77, programme de parrainage
const myReferral = asyncHandler(async (req, res) => {
  const referrals = await prisma.customerProfile.findMany({
    where: { referredById: req.customerProfile.id },
    include: { user: { select: { firstName: true, lastName: true, createdAt: true } } },
  });
  res.json({
    referralCode: req.customerProfile.referralCode,
    referralsCount: referrals.length,
    referrals: referrals.map((r) => ({ name: `${r.user.firstName} ${r.user.lastName}` })),
  });
});

module.exports = { listCustomers, getCustomer, requestProfessionalStatus, updateProfessionalStatus, myReferral };
