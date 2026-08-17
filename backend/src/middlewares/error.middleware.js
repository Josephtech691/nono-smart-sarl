const ApiError = require('../utils/ApiError');

function notFoundHandler(req, res, next) {
  next(new ApiError(404, `Route introuvable : ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Erreur serveur inattendue';

  // Erreurs Prisma connues -> messages lisibles cote client
  if (err.code === 'P2002') {
    statusCode = 409;
    message = `Une ressource avec cette valeur existe deja (${err.meta?.target || 'champ unique'})`;
  }
  if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Ressource introuvable';
  }

  if (statusCode >= 500) {
    console.error('[ERROR]', err);
  }

  res.status(statusCode).json({
    message,
    details: err.details || undefined,
  });
}

module.exports = { notFoundHandler, errorHandler };
