require('dotenv').config();
const app = require('./app');
const prisma = require('./config/db');
const { scheduleRecurringOrdersJob } = require('./jobs/recurringOrders.job');

const PORT = process.env.PORT || 4000;

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Variables d'environnement manquantes : ${missing.join(', ')}`);
  console.error('Copiez .env.example vers .env et completez les valeurs.');
  process.exit(1);
}

const server = app.listen(PORT, () => {
  console.log(`API NONO SMART demarree sur le port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  scheduleRecurringOrdersJob();
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
