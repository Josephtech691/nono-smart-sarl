const ApiError = require('../utils/ApiError');

// Valide req.body (par defaut) contre un schema Zod. Sur echec, renvoie une
// 400 avec le detail des champs en erreur plutot qu'un message Zod brut.
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return next(new ApiError(400, 'Donnees invalides', details));
  }
  req[source] = result.data;
  next();
};

module.exports = validate;
