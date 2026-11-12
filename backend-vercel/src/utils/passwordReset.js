const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Reinitialisation du mot de passe par code SMS a 6 chiffres, sans table
// supplementaire : le serveur remet au client un jeton signe (valable 15 min)
// qui contient l'empreinte HMAC du code envoye par SMS. Le code lui-meme n'est
// jamais renvoye au client.
//
// Securite :
// - le jeton est signe avec une cle DERIVEE de JWT_SECRET (et non JWT_SECRET) :
//   il ne peut donc jamais etre accepte comme jeton de connexion ;
// - HMAC avec cle serveur (et non simple hash) : impossible de retrouver le code
//   hors-ligne a partir du jeton ;
// - l'empreinte du mot de passe actuel est incluse : le jeton devient inutilisable
//   des que le mot de passe change (usage unique) ;
// - compteur d'echecs par compte (en memoire, au mieux) en plus du rate-limit par IP.

const RESET_TTL_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

function baseSecret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET manquant');
  return process.env.JWT_SECRET;
}
const resetSecret = () => crypto.createHmac('sha256', baseSecret()).update('fresh-fish:password-reset:v1').digest('hex');
const fingerprint = (passwordHash) => crypto.createHash('sha256').update(String(passwordHash || '')).digest('hex').slice(0, 16);
const codeMac = (userId, code) => crypto.createHmac('sha256', resetSecret()).update(`${userId}:${code}`).digest('hex');

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function issueResetToken(user, code) {
  return jwt.sign(
    { purpose: 'pwd-reset', sub: user.id, pv: fingerprint(user.password), mac: codeMac(user.id, code) },
    resetSecret(),
    { expiresIn: `${RESET_TTL_MINUTES}m` }
  );
}

// Jeton factice de meme forme pour un identifiant inconnu : la reponse de
// /forgot-password ne revele pas si un compte existe.
function issueDecoyToken() {
  return jwt.sign(
    { purpose: 'pwd-reset', sub: crypto.randomUUID(), pv: crypto.randomBytes(8).toString('hex'), mac: crypto.randomBytes(32).toString('hex') },
    resetSecret(),
    { expiresIn: `${RESET_TTL_MINUTES}m` }
  );
}

function verifyResetToken(token) {
  const payload = jwt.verify(token, resetSecret());
  if (payload.purpose !== 'pwd-reset' || !payload.sub || !payload.mac) throw new Error('jeton invalide');
  return payload;
}

// Verifie le code saisi ET que le mot de passe n'a pas change depuis l'emission du jeton.
function isResetValid(payload, user, code) {
  if (!user) return false;
  const expected = Buffer.from(String(payload.mac), 'hex');
  const actual = Buffer.from(codeMac(payload.sub, String(code)), 'hex');
  const codeOk = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  const passwordUnchanged = payload.pv === fingerprint(user.password);
  return codeOk && passwordUnchanged;
}

const failures = new Map();

function tooManyAttempts(userId) {
  const entry = failures.get(userId);
  return !!entry && entry.resetAt > Date.now() && entry.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailure(userId) {
  const now = Date.now();
  const entry = failures.get(userId);
  if (!entry || entry.resetAt <= now) failures.set(userId, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
  else entry.count += 1;
  if (failures.size > 5000) {
    for (const [key, value] of failures) if (value.resetAt <= now) failures.delete(key);
  }
}

function clearFailures(userId) {
  failures.delete(userId);
}

module.exports = {
  RESET_TTL_MINUTES,
  generateCode,
  issueResetToken,
  issueDecoyToken,
  verifyResetToken,
  isResetValid,
  tooManyAttempts,
  recordFailure,
  clearFailures,
};
