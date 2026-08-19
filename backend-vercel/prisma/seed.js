// Peuple la base avec les donnees reelles de NONO SMART SARL (issues du
// cahier des charges et de la maquette) : categories, produits avec paliers
// de prix degressifs, zones de livraison, un code promo de demonstration et
// des comptes de demonstration (admin / livreur / client).
//
// Usage : npm run seed   (apres npx prisma migrate deploy)

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Nettoyage des tables existantes...');
  // Ordre inverse des dependances pour eviter les erreurs de cle etrangere.
  await prisma.orderStatusHistory.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.review.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.productPriceTier.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.deliveryZone.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.address.deleteMany();
  await prisma.driverProfile.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.user.deleteMany();

  console.log('Creation des categories...');
  const silures = await prisma.category.create({
    data: { name: 'Silures frais', slug: 'silures-frais', description: 'Silures frais peches localement', position: 1 },
  });
  const alevins = await prisma.category.create({
    data: { name: 'Alevins', slug: 'alevins', description: 'Alevins de silure pour pisciculteurs', position: 2 },
  });

  console.log('Creation des produits...');
  // Prix de base tires de la maquette : silure 2 500 FCFA/kg, alevin 100 FCFA/unite.
  // Les paliers ci-dessous sont des valeurs indicatives a ajuster depuis le
  // dashboard admin (Produits > paliers de prix).
  const silureFrais = await prisma.product.create({
    data: {
      name: 'Silure frais',
      slug: 'silure-frais',
      description: "Silure frais entier, peche du jour. Prix degressif selon la quantite commandee.",
      price: 2500,
      costPrice: 1600,
      unit: 'KILOGRAM',
      categoryId: silures.id,
      stockQuantity: 120,
      alertThreshold: 15,
      minOrderQuantity: 1,
      isFeatured: true,
      images: {
        create: [
          { url: '/products/silure-1.jpg', altText: 'Silure frais', position: 0 },
          { url: '/products/silure-2.jpg', altText: 'Silures frais en bassin', position: 1 },
          { url: '/products/silure-3.jpg', altText: 'Silure frais gros plan', position: 2 },
        ],
      },
      priceTiers: {
        create: [
          { minQuantity: 1, unitPrice: 2500 },
          { minQuantity: 5, unitPrice: 2300 },
          { minQuantity: 10, unitPrice: 2100 },
          { minQuantity: 20, unitPrice: 1900 },
        ],
      },
    },
  });

  const alevinsSilure = await prisma.product.create({
    data: {
      name: 'Alevins de silure',
      slug: 'alevins-de-silure',
      description: 'Alevins de silure pour pisciculteurs, vendus a l\'unite avec prix degressif par quantite.',
      price: 100,
      costPrice: 55,
      unit: 'PIECE',
      categoryId: alevins.id,
      stockQuantity: 8000,
      alertThreshold: 500,
      minOrderQuantity: 50,
      isFeatured: true,
      images: {
        create: [
          { url: '/products/alevins-1.jpg', altText: 'Alevins de silure dans les mains', position: 0 },
          { url: '/products/alevins-2.jpg', altText: 'Alevins de silure en bassine', position: 1 },
          { url: '/products/alevins-3.jpg', altText: 'Alevins de silure en bassin', position: 2 },
        ],
      },
      priceTiers: {
        create: [
          { minQuantity: 100, unitPrice: 100 },
          { minQuantity: 500, unitPrice: 90 },
          { minQuantity: 1000, unitPrice: 80 },
          { minQuantity: 5000, unitPrice: 70 },
        ],
      },
    },
  });

  console.log('Creation des zones de livraison (section 15)...');
  await prisma.deliveryZone.createMany({
    data: [
      { name: 'Essos', fee: 500 },
      { name: 'Centre-ville', fee: 1000 },
      { name: 'Bastos', fee: 1500 },
      { name: 'Odza', fee: 1500 },
      { name: 'Nkolbisson', fee: 2000 },
    ],
  });

  console.log('Creation du code promo de demonstration...');
  await prisma.coupon.create({
    data: {
      code: 'PROMO10',
      type: 'PERCENTAGE',
      value: 10,
      minOrderAmount: 20000,
      expiresAt: new Date('2026-08-31T23:59:59Z'),
    },
  });

  console.log('Creation des comptes de demonstration...');
  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.user.create({
    data: {
      firstName: 'Admin',
      lastName: 'NONO SMART',
      phone: '659103000',
      email: 'admin@nonosmart.cm',
      password: passwordHash,
      role: 'ADMIN',
    },
  });

  await prisma.user.create({
    data: {
      firstName: 'Jean',
      lastName: 'Livreur',
      phone: '674331099',
      email: 'jean.livreur@nonosmart.cm',
      password: passwordHash,
      role: 'DRIVER',
      driverProfile: { create: { status: 'AVAILABLE', vehicle: 'Moto' } },
    },
  });

  await prisma.user.create({
    data: {
      firstName: 'Client',
      lastName: 'Demo',
      phone: '690000000',
      email: 'client@demo.cm',
      password: passwordHash,
      role: 'CUSTOMER',
      customerProfile: { create: { referralCode: 'CLI0001' } },
    },
  });

  // Client professionnel de demonstration (section 47 / 75 - tarifs grossistes)
  await prisma.user.create({
    data: {
      firstName: 'Restaurant',
      lastName: 'Le Bassin',
      phone: '691000000',
      email: 'pro@demo.cm',
      password: passwordHash,
      role: 'CUSTOMER',
      customerProfile: {
        create: {
          referralCode: 'PRO0001',
          customerType: 'PROFESSIONNEL',
          professionalStatus: 'APPROVED',
          businessName: 'Restaurant Le Bassin',
          wholesaleDiscountPercent: 8,
        },
      },
    },
  });

  console.log('\nSeed termine avec succes.');
  console.log('Comptes de demonstration (mot de passe : password123) :');
  console.log('  Admin        -> telephone 659103000 / admin@nonosmart.cm');
  console.log('  Livreur      -> telephone 674331099 / jean.livreur@nonosmart.cm');
  console.log('  Client       -> telephone 690000000 / client@demo.cm');
  console.log('  Client pro   -> telephone 691000000 / pro@demo.cm (remise grossiste 8%)');
  console.log(`Produits crees : ${silureFrais.name}, ${alevinsSilure.name}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
