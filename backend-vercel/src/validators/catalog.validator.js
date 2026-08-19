const { z } = require('zod');

const priceTierSchema = z.object({
  minQuantity: z.number().positive(),
  unitPrice: z.number().int().positive(),
});

const productSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  price: z.number().int().positive(),
  costPrice: z.number().int().min(0).optional(),
  unit: z.enum(['GRAM', 'KILOGRAM', 'PIECE', 'LOT', 'UNIT_50', 'UNIT_100', 'UNIT_500', 'UNIT_1000', 'CUSTOM']),
  categoryId: z.string().min(1),
  stockQuantity: z.number().min(0).optional(),
  alertThreshold: z.number().min(0).optional(),
  minOrderQuantity: z.number().positive().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  images: z.array(z.string().url()).optional(),
  priceTiers: z.array(priceTierSchema).optional(),
});

const productUpdateSchema = productSchema.partial();

const categorySchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

module.exports = { productSchema, productUpdateSchema, categorySchema };
