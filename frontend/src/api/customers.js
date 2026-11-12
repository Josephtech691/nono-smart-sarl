import api from './client';

export const customersApi = {
  list: (params) => api.get('/customers', { params }).then((r) => r.data),
  get: (id) => api.get(`/customers/${id}`).then((r) => r.data),
  requestProfessional: (data) => api.patch('/customers/me/professional-request', data).then((r) => r.data),
  updateProfessionalStatus: (id, data) => api.patch(`/customers/${id}/professional-status`, data).then((r) => r.data),
  // Prix speciaux : le client lit les siens ; l'administration les gere par client.
  myPrices: () => api.get('/customers/me/prices').then((r) => r.data),
  prices: (id) => api.get(`/customers/${id}/prices`).then((r) => r.data),
  setPrice: (id, data) => api.put(`/customers/${id}/prices`, data).then((r) => r.data),
  removePrice: (id, priceId) => api.delete(`/customers/${id}/prices/${priceId}`).then((r) => r.data),
  myReferral: () => api.get('/customers/me/referral').then((r) => r.data),
  resetPassword: (id) => api.post(`/customers/${id}/reset-password`).then((r) => r.data),
};
