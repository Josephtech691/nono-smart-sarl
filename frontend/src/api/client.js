import axios from 'axios';
import { TOKEN_KEY, getToken } from '../utils/tokenStorage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export { TOKEN_KEY };

export const api = axios.create({ baseURL: API_URL });

// Session expirée ou invalide : le store d'authentification s'enregistre ici (évite un import circulaire)
// pour déconnecter l'utilisateur ; la route protégée le renvoie alors sur SA page de connexion
// (clients : /connexion, livreurs : /livreur/connexion, admin : /admin/connexion).
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};
const AUTH_ENDPOINTS = /\/auth\/(login|register|google|reset|forgot|verify)/;

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalise le message d'erreur pour l'affichage direct dans l'UI
// (le backend renvoie { message, details? }).
api.interceptors.response.use(
  (res) => res,
  (error) => {
    // 401 avec un jeton envoyé = session expirée (un mauvais mot de passe à la connexion n'est pas concerné).
    if (error.response?.status === 401 && getToken() && !AUTH_ENDPOINTS.test(error.config?.url || '')) {
      onUnauthorized?.();
    }
    const message = error.response?.data?.message || 'Une erreur est survenue, veuillez réessayer.';
    const details = error.response?.data?.details;
    return Promise.reject({ message, details, status: error.response?.status, raw: error });
  }
);

export default api;
