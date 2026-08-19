const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { runDueRecurringOrders } = require('../jobs/recurringOrders.job');

// Verifie que l'appel vient bien de Vercel Cron (qui envoie automatiquement
// `Authorization: Bearer ${CRON_SECRET}` lorsque la variable d'environnement
// CRON_SECRET est definie sur le projet Vercel), et non d'un tiers qui aurait
// devine l'URL. Si CRON_SECRET n'est pas configure (ex: tests locaux), la
// verification est ignoree - pensez a le definir en production.
function verifyCronSecret(req) {
  if (!process.env.CRON_SECRET) return;
  const header = req.headers.authorization || '';
  if (header !== `Bearer ${process.env.CRON_SECRET}`) {
    throw new ApiError(401, 'Non autorise');
  }
}

// GET /api/cron/recurring-orders - appele quotidiennement par Vercel Cron
// (voir vercel.json). Peut aussi etre declenche manuellement en local pour
// tester : `vercel crons run /api/cron/recurring-orders` ou un simple curl
// avec le bon header Authorization.
const recurringOrders = asyncHandler(async (req, res) => {
  verifyCronSecret(req);
  const processed = await runDueRecurringOrders();
  res.json({ message: 'Traitement termine', processed });
});

module.exports = { recurringOrders };
