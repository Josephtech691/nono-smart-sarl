import { create } from 'zustand';

let counter = 0;

export const useToastStore = create((set, get) => ({
  toasts: [],

  addToast: (message, type = 'success') => {
    const id = ++counter;
    set({ toasts: [...get().toasts, { id, message, type }] });
    setTimeout(() => get().removeToast(id), 3200);
  },

  removeToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

// Raccourcis pratiques utilisables partout : toast.success('...'), toast.error('...')
export const toast = {
  success: (message) => useToastStore.getState().addToast(message, 'success'),
  error: (message) => useToastStore.getState().addToast(message, 'error'),
  info: (message) => useToastStore.getState().addToast(message, 'info'),
};
