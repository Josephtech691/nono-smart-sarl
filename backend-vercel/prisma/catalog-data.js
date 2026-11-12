// Variantes de "Silures frais" : celles du cahier des charges (section 7 :
// entier, nettoye, decoupe, gros, moyen) + "silure fume" vu sur la maquette.
//
// IMPORTANT : prix de base repris de la maquette ; paliers, couts et stocks sont
// INDICATIFS (a ajuster dans Admin > Produits). Les photos sont celles de
// l'entreprise reutilisees comme visuels provisoires : remplacez-les par la photo
// reelle de chaque variante depuis Admin > Produits.

const SILURE_VARIANTS = [
  {
    name: 'Silure entier',
    slug: 'silure-entier',
    description: "Silure entier, frais du jour. Ideal a griller, a braiser ou a preparer en sauce. Prix degressif selon la quantite.",
    price: 2500,
    costPrice: 1600,
    stockQuantity: 80,
    alertThreshold: 10,
    isFeatured: true,
    images: ['/products/silure-1.jpg', '/products/silure-2.jpg', '/products/silure-3.jpg'],
    tiers: [[1, 2500], [5, 2300], [10, 2100]],
  },
  {
    name: 'Silure nettoyé',
    slug: 'silure-nettoye',
    description: 'Silure frais vide, lave et nettoye : il ne vous reste qu\'a le cuisiner. Prix degressif selon la quantite.',
    price: 2800,
    costPrice: 1800,
    stockQuantity: 60,
    alertThreshold: 10,
    images: ['/products/silure-2.jpg', '/products/silure-1.jpg'],
    tiers: [[1, 2800], [5, 2600], [10, 2400]],
  },
  {
    name: 'Silure découpé',
    slug: 'silure-decoupe',
    description: 'Silure frais decoupe en morceaux, pret a cuisiner. Pratique pour les repas de famille. Prix degressif selon la quantite.',
    price: 3000,
    costPrice: 1950,
    stockQuantity: 60,
    alertThreshold: 10,
    images: ['/products/silure-3.jpg', '/products/silure-2.jpg'],
    tiers: [[1, 3000], [5, 2800], [10, 2600]],
  },
  {
    name: 'Gros silure',
    slug: 'gros-silure',
    description: 'Gros silure frais, ideal pour les grandes tablees, les fetes et la restauration. Prix degressif selon la quantite.',
    price: 3500,
    costPrice: 2300,
    stockQuantity: 40,
    alertThreshold: 8,
    images: ['/products/hero-silure.jpg', '/products/silure-1.jpg'],
    tiers: [[1, 3500], [5, 3300], [10, 3100]],
  },
  {
    name: 'Silure moyen',
    slug: 'silure-moyen',
    description: 'Silure frais de taille moyenne, pratique pour la famille. Prix degressif selon la quantite.',
    price: 2500,
    costPrice: 1600,
    stockQuantity: 70,
    alertThreshold: 10,
    images: ['/products/silure-2.jpg', '/products/silure-3.jpg'],
    tiers: [[1, 2500], [5, 2300], [10, 2100]],
  },
  {
    name: 'Silure fumé',
    slug: 'silure-fume',
    description: 'Silure fume, savoureux et parfume. Prix degressif selon la quantite.',
    price: 4000,
    costPrice: 2700,
    stockQuantity: 25,
    alertThreshold: 5,
    images: ['/products/silure-3.jpg', '/products/silure-1.jpg'],
    tiers: [[1, 4000], [5, 3800], [10, 3600]],
  },
];

// Transforme une variante ci-dessus en donnees pour prisma.product.create (unite : kilogramme).
function toProductCreateData(variant, categoryId) {
  return {
    name: variant.name,
    slug: variant.slug,
    description: variant.description,
    price: variant.price,
    costPrice: variant.costPrice,
    unit: 'KILOGRAM',
    categoryId,
    stockQuantity: variant.stockQuantity,
    alertThreshold: variant.alertThreshold,
    minOrderQuantity: 1,
    isFeatured: !!variant.isFeatured,
    images: {
      create: variant.images.map((url, position) => ({ url, altText: variant.name, position })),
    },
    priceTiers: {
      create: variant.tiers.map(([minQuantity, unitPrice]) => ({ minQuantity, unitPrice })),
    },
  };
}

module.exports = { SILURE_VARIANTS, toProductCreateData };
