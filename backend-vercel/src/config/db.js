const { PrismaClient } = require('@prisma/client');

// IMPORTANT (specifique a la variante Vercel) : sur une plateforme serverless,
// chaque invocation "froide" peut re-executer ce module, et chaque instance de
// PrismaClient ouvre son propre pool de connexions Postgres. Sans precaution,
// un pic de trafic peut vite epuiser la limite de connexions de la base.
//
// On utilise donc le pattern singleton recommande par Prisma pour le
// serverless : l'instance est stockee sur `globalThis`, ce qui permet de la
// reutiliser entre les invocations "chaudes" d'un meme conteneur de fonction,
// au lieu d'en recreer une a chaque requete. (Contrairement au pattern
// classique Next.js, on met en cache MEME en production ici : sur Vercel,
// "production" reste une fonction serverless, pas un process persistant.)
//
// Cote base de donnees, utilisez imperativement une URL de connexion "pooled"
// (PgBouncer / Prisma Accelerate / pooler Neon ou Supabase) pour DATABASE_URL -
// voir .env.example et README.md. Une connexion Postgres directe classique ne
// tient pas la charge en environnement serverless.

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__freshFishPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

globalForPrisma.__freshFishPrisma = prisma;

module.exports = prisma;
