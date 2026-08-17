import api from './client';

export const customersApi = {
  list: (params) => api.get('/customers', { params }).then((r) => r.data),
  get: (id) => api.get(`/customers/${id}`).then((r) => r.data),
  requestProfessional: (data) => api.patch('/customers/me/professional-request', data).then((r) => r.data),
  updateProfessionalStatus: (id, data) => api.patch(`/customers/${id}/professional-status`, data).then((r) => r.data),
  myReferral: () => api.get('/customers/me/referral').then((r) => r.data),
};
