const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notify, notifyAdmins } = require('../utils/notify');
const { SAFE_USER_SELECT } = require('../utils/safeUser');
const { isPendingPhone } = require('../utils/phone');
const { generateTempPassword } = require('../utils/tempPassword');

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
      include: { user: { select: SAFE_USER_SELECT }, _count: { select: { orders: true } } },
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
      user: { select: SAFE_USER_SELECT },
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
    link: '/admin/clients?statut=PENDING',
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

  // Remise entiere (colonne Int) comprise entre 0 et 50 % : une valeur decimale ferait echouer l'enregistrement.
  const discount = status === 'APPROVED' ? Math.min(50, Math.max(0, Math.round(Number(wholesaleDiscountPercent) || 0))) : 0;

  const updated = await prisma.customerProfile.update({
    where: { id },
    data: {
      professionalStatus: status,
      customerType: status === 'APPROVED' ? 'PROFESSIONNEL' : 'PARTICULIER',
      wholesaleDiscountPercent: discount,
    },
  });

  await notify({
    userId: customer.userId,
    audience: 'CUSTOMER',
    title: status === 'APPROVED' ? 'Compte professionnel approuvé' : 'Demande professionnelle refusée',
    message:
      status === 'APPROVED'
        ? `Votre compte professionnel a été approuvé avec une remise grossiste de ${discount}%.`
        : "Votre demande de compte professionnel n'a pas été approuvée. Contactez-nous pour plus d'informations.",
    link: '/compte/profil',
    phone: customer.user.phone,
    sms: true,
  });

  res.json(updated);
});

// POST /api/customers/:id/reset-password (admin) - mot de passe provisoire, affiche une seule fois.
// Utile tant que l'envoi de SMS n'est pas branche (le client ne recoit pas son code « mot de passe
// oublie ») : l'administrateur le lui communique par telephone. Le client le change ensuite dans son profil.
const resetCustomerPassword = asyncHandler(async (req, res) => {
  const customer = await prisma.customerProfile.findUnique({ where: { id: req.params.id }, include: { user: { select: SAFE_USER_SELECT } } });
  if (!customer) throw new ApiError(404, 'Client introuvable');
  // Compte cree avec Google, sans telephone ni email saisis : aucun identifiant pour se connecter avec un mot de passe.
  if (isPendingPhone(customer.user.phone) && !customer.user.email) {
    throw new ApiError(400, 'Ce client se connecte avec Google : il n\'a pas de mot de passe a reinitialiser');
  }

  const temporaryPassword = generateTempPassword();
  await prisma.user.update({ where: { id: customer.userId }, data: { password: await bcrypt.hash(temporaryPassword, 10) } });

  res.set('Cache-Control', 'no-store');
  res.json({ temporaryPassword });
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

// PATCH /api/customers/:id/active (admin) - active ou desactive le compte d'un client.
// Un compte desactive ne peut plus se connecter (la session en cours est aussi refusee) ni recevoir de notifications push.
const setCustomerActive = asyncHandler(async (req, res) => {
  const { isActive } = req.body || {};
  if (typeof isActive !== 'boolean') throw new ApiError(400, 'Valeur invalide');
  const customer = await prisma.customerProfile.findUnique({ where: { id: req.params.id }, include: { user: true } });
  if (!customer) throw new ApiError(404, 'Client introuvable');
  if (customer.user.phone.startsWith('deleted-')) throw new ApiError(400, 'Ce compte a ete supprime par le client');

  await prisma.$transaction([
    prisma.user.update({ where: { id: customer.userId }, data: { isActive } }),
    ...(isActive ? [] : [prisma.deviceToken.deleteMany({ where: { userId: customer.userId } })]),
  ]);
  const updated = await prisma.customerProfile.findUnique({
    where: { id: customer.id },
    include: { user: { select: SAFE_USER_SELECT }, _count: { select: { orders: true } } },
  });
  res.json(updated);
});

// ---------------------------------------------------------------------------
// Prix speciaux par client : l'administration fixe un prix pour UN client et UN produit (ou une variante). Ce prix
// remplace les paliers degressifs et la remise grossiste, quelle que soit la quantite commandee.
// ---------------------------------------------------------------------------

const PRICE_INCLUDE = {
  product: { select: { id: true, name: true, unit: true, price: true } },
  variant: { select: { id: true, label: true, price: true } },
};

// GET /api/customers/me/prices (client) - ses propres prix speciaux (affichage panier / fiche produit)
const myPrices = asyncHandler(async (req, res) => {
  const prices = await prisma.customerProductPrice.findMany({
    where: { customerId: req.customerProfile.id },
    select: { id: true, productId: true, variantId: true, unitPrice: true },
  });
  res.set('Cache-Control', 'no-store');
  res.json(prices);
});

// GET /api/customers/:id/prices (admin)
const listCustomerPrices = asyncHandler(async (req, res) => {
  const customer = await prisma.customerProfile.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!customer) throw new ApiError(404, 'Client introuvable');
  const prices = await prisma.customerProductPrice.findMany({
    where: { customerId: customer.id },
    include: PRICE_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  res.json(prices);
});

// PUT /api/customers/:id/prices (admin) - cree ou remplace le prix special d'un produit / d'une variante
const setCustomerPrice = asyncHandler(async (req, res) => {
  const { productId, variantId = null, unitPrice } = req.body;
  const customer = await prisma.customerProfile.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!customer) throw new ApiError(404, 'Client introuvable');

  const product = await prisma.product.findUnique({ where: { id: productId }, include: { variants: { where: { isActive: true } } } });
  if (!product) throw new ApiError(404, 'Produit introuvable');

  if (product.variants.length > 0) {
    if (!variantId) throw new ApiError(400, 'Ce produit a plusieurs poids : choisissez la variante concernee');
    if (!product.variants.some((v) => v.id === variantId)) throw new ApiError(400, 'Variante invalide pour ce produit');
  } else if (variantId) {
    throw new ApiError(400, 'Variante invalide pour ce produit');
  }

  const saved = await prisma.$transaction(async (tx) => {
    const existing = await tx.customerProductPrice.findFirst({ where: { customerId: customer.id, productId, variantId: variantId || null } });
    if (existing) return tx.customerProductPrice.update({ where: { id: existing.id }, data: { unitPrice }, include: PRICE_INCLUDE });
    return tx.customerProductPrice.create({ data: { customerId: customer.id, productId, variantId: variantId || null, unitPrice }, include: PRICE_INCLUDE });
  });
  res.json(saved);
});

// DELETE /api/customers/:id/prices/:priceId (admin) - le client retrouve les prix normaux
const deleteCustomerPrice = asyncHandler(async (req, res) => {
  const price = await prisma.customerProductPrice.findFirst({ where: { id: req.params.priceId, customerId: req.params.id } });
  if (!price) throw new ApiError(404, 'Prix special introuvable');
  await prisma.customerProductPrice.delete({ where: { id: price.id } });
  res.json({ message: 'Prix special supprime' });
});

module.exports = { listCustomers, getCustomer, requestProfessionalStatus, updateProfessionalStatus, resetCustomerPassword, setCustomerActive, myReferral, myPrices, listCustomerPrices, setCustomerPrice, deleteCustomerPrice };
