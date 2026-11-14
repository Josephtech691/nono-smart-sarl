const { z } = require('zod');

const addressInputSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(8),
  region: z.string().optional(),
  city: z.string().optional(),
  district: z.string().min(2, 'Le quartier est requis'),
  landmark: z.string().optional(),
  instructions: z.string().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  saveAddress: z.boolean().optional(),
});

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1).optional().nullable(),
        quantity: z.number().positive('La quantite doit etre superieure a 0'),
      })
    )
    .min(1, 'Le panier est vide'),
  guestName: z.string().optional(),
  guestPhone: z.string().optional(),
  addressId: z.string().optional(),
  newAddress: addressInputSchema.optional(),
  // Livraison a tarif unique : la zone n'est plus necessaire (acceptee pour compatibilite).
  deliveryZoneId: z.string().min(1).optional().nullable(),
  paymentMethod: z.enum(['MTN_MOMO', 'ORANGE_MONEY', 'CASH']),
  paymentPhoneNumber: z.string().optional(),
  couponCode: z.string().optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'READY',
    'ASSIGNED',
    'PICKED_UP',
    'ON_DELIVERY',
    'DELIVERED',
    'CANCELLED',
  ]),
  note: z.string().optional(),
  // Livreur choisi par l'administration en passant la commande a « Prete » ou « Assignee ».
  driverId: z.string().min(1).optional(),
});

// Validation exceptionnelle « livrée » par l'administration : un motif (preuves vues) est obligatoire.
const forceDeliverSchema = z.object({
  reason: z.string().trim().min(5, 'Indiquez le motif et les preuves vues (5 caracteres minimum)').max(500),
  cashReceived: z.number().min(0).optional().nullable(),
});

module.exports = { addressInputSchema, createOrderSchema, updateStatusSchema, forceDeliverSchema };
