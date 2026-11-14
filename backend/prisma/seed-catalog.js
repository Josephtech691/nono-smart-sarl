// Ajoute au catalogue les variantes de silure (entier, nettoye, decoupe, gros,
// moyen, fume) SANS RIEN SUPPRIMER NI MODIFIER : un produit dont le slug existe
// deja est simplement ignore. On peut donc le relancer sans risque, y compris
// sur une base de production deja remplie (contrairement a `npm run seed` qui
// repart de zero).
//
// Usage : npm run seed:catalog

const { PrismaClient } = require('@prisma/client');
const { SILURE_VARIANTS, toProductCreateData } = require('./catalog-data');

const prisma = new PrismaClient();

async function main() {
  let category = await prisma.category.findUnique({ where: { slug: 'silures-frais' } });
  if (!category) {
    console.log('Categorie "Silures frais" absente : creation.');
    category = await prisma.category.create({
      data: { name: 'Silures frais', slug: 'silures-frais', description: "Poissons d'eau douce frais et savoureux", position: 1 },
    });
  }

  let created = 0;
  let skipped = 0;
  for (const variant of SILURE_VARIANTS) {
    const existing = await prisma.product.findUnique({ where: { slug: variant.slug } });
    if (existing) {
      skipped += 1;
      console.log(`  = ${variant.name} existe deja, ignore`);
      continue;
    }
    await prisma.product.create({ data: toProductCreateData(variant, category.id) });
    created += 1;
    console.log(`  + ${variant.name} cree`);
  }

  console.log(`\nTermine : ${created} produit(s) cree(s), ${skipped} deja present(s).`);
  console.log('Pensez a remplacer les photos provisoires depuis Admin > Produits.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
