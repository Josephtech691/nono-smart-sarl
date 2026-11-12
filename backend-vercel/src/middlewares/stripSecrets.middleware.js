// Filet de securite : retire toute cle "password" (hash bcrypt) de TOUTE reponse JSON,
// meme si un controleur oublie de restreindre un `include: { user: true }`.
function stripSecrets(value) {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (key === 'password') continue;
      out[key] = stripSecrets(val);
    }
    return out;
  }
  return value;
}

module.exports = function stripSecretsMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(stripSecrets(body));
  next();
};

module.exports.stripSecrets = stripSecrets;
