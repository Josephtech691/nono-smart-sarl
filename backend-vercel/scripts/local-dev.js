// Serveur local pour le developpement UNIQUEMENT. En production, Vercel
// n'utilise jamais ce fichier : il detecte et deploie directement
// src/app.js (voir la doc "Express on Vercel" - export par defaut, zero
// configuration). Ce fichier existe seulement pour pouvoir lancer
// `npm run dev` en local sans installer la CLI Vercel.
//
// Les commandes recurrentes ne sont PAS planifiees ici (pas de node-cron) :
// en production c'est un Vercel Cron Job qui appelle GET /api/cron/recurring-orders
// (voir vercel.json). En local, testez cette route manuellement :
//   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:4000/api/cron/recurring-orders

require('dotenv').config();
const app = require('../src/app');
const prisma = require('../src/config/db');

const PORT = process.env.PORT || 4000;

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Variables d'environnement manquantes : ${missing.join(', ')}`);
  console.error('Copiez .env.example vers .env et completez les valeurs.');
  process.exit(1);
}

const server = app.listen(PORT, () => {
  console.log(`API Fresh Fish (variante Vercel) demarree sur le port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

async function shutdown(signal) {
  console.log(`\n${signal} recu, arret propre du serveur...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
