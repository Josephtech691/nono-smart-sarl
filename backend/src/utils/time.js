// Le Cameroun est a UTC+1 toute l'annee (pas d'heure d'ete) : « aujourd'hui » pour un
// livreur ou pour l'administration commence a minuit heure de Douala, soit 23:00 UTC la veille.
// Les hebergeurs (Render, Vercel) tournent en UTC : on n'utilise donc jamais les getters
// « locaux » de Date (getDate, setHours...) pour decouper les journees.
const DOUALA_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayDouala(date = new Date()) {
  const local = new Date(date.getTime() + DOUALA_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - DOUALA_OFFSET_MS);
}

// Jour calendaire (AAAA-MM-JJ) d'un instant, a l'heure de Douala.
function formatDoualaDay(date) {
  return new Date(new Date(date).getTime() + DOUALA_OFFSET_MS).toISOString().slice(0, 10);
}

// Heure (HH:MM) d'un instant, a l'heure de Douala.
function formatDoualaTime(date) {
  return new Date(new Date(date).getTime() + DOUALA_OFFSET_MS).toISOString().slice(11, 16);
}

// « 2026-11-07 » -> minuit (heure de Douala) de ce jour ; null si ce n'est pas une date valide.
function parseDoualaDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utc = new Date(Date.UTC(year, month - 1, day));
  // Refuse les dates qui n'existent pas (31 fevrier, mois 13...) que Date.UTC « corrige » en silence.
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  return new Date(utc.getTime() - DOUALA_OFFSET_MS);
}

// Debut du mois (heure de Douala) ; monthsBack = 1 donne le debut du mois precedent.
function startOfMonthDouala(date = new Date(), monthsBack = 0) {
  const local = new Date(date.getTime() + DOUALA_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - monthsBack, 1) - DOUALA_OFFSET_MS);
}

module.exports = {
  DOUALA_OFFSET_MS,
  DAY_MS,
  startOfDayDouala,
  startOfMonthDouala,
  formatDoualaDay,
  formatDoualaTime,
  parseDoualaDay,
};
