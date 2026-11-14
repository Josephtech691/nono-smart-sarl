import { create } from 'zustand';
import { authApi } from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';
import { getToken, setToken, clearToken } from '../utils/tokenStorage';

export const useAuthStore = create((set, get) => ({
  user: null,
  status: 'idle',
  error: null,

  isAuthenticated: () => !!get().user,

  hydrate: async () => {
    const token = getToken();
    if (!token) return set({ status: 'ready' });
    try {
      const user = await authApi.me();
      set({ user, status: 'ready' });
    } catch (err) {
      clearToken();
      set({ user: null, status: 'ready' });
    }
  },

  // `remember` (defaut : vrai) = "Se souvenir de moi" ; il n'est pas envoye au serveur.
  login: async ({ remember = true, ...credentials }) => {
    set({ error: null });
    const { token, user } = await authApi.login(credentials);
    setToken(token, remember);
    set({ user });
    return user;
  },

  register: async (data) => {
    set({ error: null });
    const { token, user } = await authApi.register(data);
    setToken(token, true);
    set({ user });
    return user;
  },

  loginWithGoogle: async (credential) => {
    set({ error: null });
    const { token, user } = await authApi.google(credential);
    setToken(token, true);
    set({ user });
    return user;
  },

  // Fin de la procedure "mot de passe oublie" : le serveur connecte directement le client.
  resetPassword: async (data) => {
    set({ error: null });
    const { token, user } = await authApi.resetPassword(data);
    setToken(token, true);
    set({ user });
    return user;
  },

  updateProfile: async (data) => {
    const user = await authApi.updateMe(data);
    set({ user });
    return user;
  },

  logout: () => {
    clearToken();
    set({ user: null });
  },
}));

// Session expirée en cours d'utilisation : déconnexion immédiate, les routes protégées redirigent vers la connexion.
setUnauthorizedHandler(() => {
  clearToken();
  useAuthStore.setState({ user: null });
});
