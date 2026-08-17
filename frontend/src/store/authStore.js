import { create } from 'zustand';
import { authApi } from '../api/auth';
import { TOKEN_KEY } from '../api/client';

export const useAuthStore = create((set, get) => ({
  user: null,
  status: 'idle', // idle | loading | ready
  error: null,

  isAuthenticated: () => !!get().user,

  // Appelé une fois au démarrage de l'app pour restaurer la session à partir
  // du token stocké (voir App.jsx).
  hydrate: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return set({ status: 'ready' });
    try {
      const user = await authApi.me();
      set({ user, status: 'ready' });
    } catch (err) {
      localStorage.removeItem(TOKEN_KEY);
      set({ user: null, status: 'ready' });
    }
  },

  login: async (credentials) => {
    set({ error: null });
    const { token, user } = await authApi.login(credentials);
    localStorage.setItem(TOKEN_KEY, token);
    set({ user });
    return user;
  },

  register: async (data) => {
    set({ error: null });
    const { token, user } = await authApi.register(data);
    localStorage.setItem(TOKEN_KEY, token);
    set({ user });
    return user;
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ user: null });
  },
}));
