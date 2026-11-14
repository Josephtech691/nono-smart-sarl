const { z } = require('zod');

const recurringOrderSchema = z.object({
  label: z.string().max(120).optional(),
  items: z
    .array(z.object({ productId: z.string().min(1), variantId: z.string().min(1).optional().nullable(), quantity: z.number().positive() }))
    .min(1, 'Le panier est vide'),
  addressId: z.string().min(1),
  deliveryZoneId: z.string().min(1).optional().nullable(),
  paymentMethod: z.enum(['MTN_MOMO', 'ORANGE_MONEY', 'CASH']),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']),
  startDate: z.string().datetime().optional(),
});

const recurringOrderUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']).optional(),
  label: z.string().max(120).optional(),
});

module.exports = { recurringOrderSchema, recurringOrderUpdateSchema };
