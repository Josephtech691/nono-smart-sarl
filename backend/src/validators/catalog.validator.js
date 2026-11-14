const { z } = require('zod');

const priceTierSchema = z.object({
  minQuantity: z.number().positive(),
  unitPrice: z.number().int().positive(),
});

// Photo d'un produit : adresse complete (http/https) ou chemin du site (« /products/silure-1.jpg », comme dans le
// catalogue de depart). Aucun autre schema (javascript:, data:...) n'est accepte.
const imageUrlSchema = z
  .string()
  .max(500)
  .refine((value) => /^https?:\/\/\S+$/i.test(value) || /^\/(?!\/)\S*$/.test(value), "Adresse d'image invalide (https://... ou /dossier/image.jpg)");

// Variante d'un produit (ex. « 300 g ») : prix par piece, photo, stock en pieces. `id` present = variante existante.
const variantSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().trim().min(1, 'Le nom de la variante est requis').max(60),
  price: z.number().int().positive(),
  imageUrl: z.union([imageUrlSchema, z.literal('')]).optional().nullable(),
  stockQuantity: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const productSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  // Facultatif quand le produit a des variantes : le prix « a partir de » est alors le plus bas prix de variante.
  price: z.number().int().positive().optional(),
  costPrice: z.number().int().min(0).optional(),
  unit: z.enum(['GRAM', 'KILOGRAM', 'PIECE', 'LOT', 'UNIT_50', 'UNIT_100', 'UNIT_500', 'UNIT_1000', 'CUSTOM']),
  categoryId: z.string().min(1),
  stockQuantity: z.number().min(0).optional(),
  alertThreshold: z.number().min(0).optional(),
  minOrderQuantity: z.number().positive().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  images: z.array(imageUrlSchema).optional(),
  priceTiers: z.array(priceTierSchema).optional(),
  variants: z.array(variantSchema).optional(),
});

const productUpdateSchema = productSchema.partial();

const categorySchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const customerPriceSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional().nullable(),
  unitPrice: z.number().int().positive('Le prix doit etre superieur a 0'),
});

module.exports = { customerPriceSchema, variantSchema, productSchema, productUpdateSchema, categorySchema };
