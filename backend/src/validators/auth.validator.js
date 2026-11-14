const { z } = require('zod');

const registerSchema = z.object({
  firstName: z.string().min(2, 'Le prenom doit contenir au moins 2 caracteres'),
  lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caracteres'),
  phone: z.string().min(8, 'Numero de telephone invalide'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caracteres'),
  referralCode: z.string().optional().or(z.literal('')),
});

const loginSchema = z.object({
  phone: z.string().min(3, 'Telephone ou email requis'),
  password: z.string().min(1, 'Mot de passe requis'),
});

const googleAuthSchema = z.object({
  credential: z.string().min(10, 'Jeton Google manquant'),
});

const updateMeSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().min(8).optional(),
  email: z.string().email().optional().or(z.literal('')),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caracteres'),
});

const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(3, 'Telephone ou email requis'),
});

const resetPasswordSchema = z.object({
  resetToken: z.string().min(20, 'Demande invalide, recommencez'),
  code: z.string().regex(/^\d{6}$/, 'Le code contient 6 chiffres'),
  newPassword: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caracteres'),
});

module.exports = {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  updateMeSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
