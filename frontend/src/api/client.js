import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export const TOKEN_KEY = 'nono_smart_token';

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalise le message d'erreur pour l'affichage direct dans l'UI
// (le backend renvoie { message, details? }).
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message = error.response?.data?.message || 'Une erreur est survenue, veuillez réessayer.';
    const details = error.response?.data?.details;
    return Promise.reject({ message, details, status: error.response?.status, raw: error });
  }
);

export default api;
