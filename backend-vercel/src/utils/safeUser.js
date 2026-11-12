// Champs utilisateur que l'API peut renvoyer au navigateur.
// IMPORTANT : ne jamais faire `include: { user: true }` dans une reponse HTTP,
// cela renverrait aussi le hash du mot de passe et l'identifiant Google.
const SAFE_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
};

module.exports = { SAFE_USER_SELECT };
