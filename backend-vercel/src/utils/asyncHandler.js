// Evite les blocs try/catch repetes dans chaque controleur : toute erreur
// (sync ou promesse rejetee) est transmise a next() -> middleware d'erreurs.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
