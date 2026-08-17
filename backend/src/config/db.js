const { PrismaClient } = require('@prisma/client');

// Instance unique du client Prisma, reutilisee dans toute l'application
// (evite d'epuiser les connexions Postgres en environnement serverless-like).
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
