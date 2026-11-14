const { z } = require('zod');

const deliveryZoneSchema = z.object({
  name: z.string().min(2),
  fee: z.number().int().min(0),
  isActive: z.boolean().optional(),
});

const couponSchema = z.object({
  code: z.string().min(3),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.number().int().positive(),
  minOrderAmount: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
});

const reviewSchema = z.object({
  quality: z.number().int().min(1).max(5),
  delivery: z.number().int().min(1).max(5),
  service: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

const driverCreateSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(6),
  vehicle: z.string().optional(),
});

// PATCH /drivers/:id (admin) : un statut inconnu ferait planter Prisma (erreur 500) au lieu d'un refus clair.
const driverUpdateSchema = z.object({
  status: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE', 'SUSPENDED']).optional(),
  vehicle: z.string().max(60).optional(),
  isActive: z.boolean().optional(),
});

const expenseSchema = z.object({
  category: z.string().min(2),
  label: z.string().min(2),
  amount: z.number().int().positive(),
  incurredAt: z.string().datetime().optional(),
});

const reportIssueSchema = z.object({
  reason: z.enum(['CLIENT_INJOIGNABLE', 'ADRESSE_INTROUVABLE', 'CLIENT_ABSENT', 'COLIS_REFUSE', 'AUTRE']),
  note: z.string().max(500).optional(),
});

module.exports = { deliveryZoneSchema, couponSchema, reviewSchema, driverCreateSchema, driverUpdateSchema, expenseSchema, reportIssueSchema };
