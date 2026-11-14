import api from './client';

export const authApi = {
  register: (data) => api.post('/auth/register', data).then((r) => r.data),
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  google: (credential) => api.post('/auth/google', { credential }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  updateMe: (data) => api.patch('/auth/me', data).then((r) => r.data),
  // Suppression du compte par le client : { password } (ou { confirm: 'SUPPRIMER' } pour un compte Google).
  deleteAccount: (data) => api.delete('/auth/me', { data }).then((r) => r.data),
  changePassword: (data) => api.patch('/auth/me/password', data).then((r) => r.data),
  forgotPassword: (identifier) => api.post('/auth/forgot-password', { identifier }).then((r) => r.data),
  resetPassword: (data) => api.post('/auth/reset-password', data).then((r) => r.data),
};
