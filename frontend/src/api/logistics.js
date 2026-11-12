import api from './client';

export const zonesApi = {
  list: (params) => api.get('/delivery-zones', { params }).then((r) => r.data),
  create: (data) => api.post('/delivery-zones', data).then((r) => r.data),
  update: (id, data) => api.patch(`/delivery-zones/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/delivery-zones/${id}`).then((r) => r.data),
};

export const addressesApi = {
  list: () => api.get('/addresses').then((r) => r.data),
  create: (data) => api.post('/addresses', data).then((r) => r.data),
  update: (id, data) => api.patch(`/addresses/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/addresses/${id}`).then((r) => r.data),
};

export const driversApi = {
  list: () => api.get('/drivers').then((r) => r.data),
  create: (data) => api.post('/drivers', data).then((r) => r.data),
  update: (id, data) => api.patch(`/drivers/${id}`, data).then((r) => r.data),
  // Administration : mot de passe provisoire (affiché une seule fois) et page « Livraisons ».
  resetPassword: (id) => api.post(`/drivers/${id}/reset-password`).then((r) => r.data),
  deliveries: (params) => api.get('/drivers/deliveries', { params }).then((r) => r.data),
  myDeliveries: (params) => api.get('/drivers/me/deliveries', { params }).then((r) => r.data),
  mySummary: () => api.get('/drivers/me/summary').then((r) => r.data),
  getDelivery: (orderId) => api.get(`/drivers/me/deliveries/${orderId}`).then((r) => r.data),
  updateDeliveryStatus: (orderId, status) => api.patch(`/drivers/me/deliveries/${orderId}/status`, { status }).then((r) => r.data),
  confirmDelivery: (orderId, data) => api.post(`/drivers/me/deliveries/${orderId}/confirm`, data).then((r) => r.data),
  reportIssue: (orderId, data) => api.post(`/drivers/me/deliveries/${orderId}/report-issue`, data).then((r) => r.data),
  updateMyStatus: (status) => api.patch('/drivers/me/status', { status }).then((r) => r.data),
  updateMyLocation: (latitude, longitude) => api.patch('/drivers/me/location', { latitude, longitude }).then((r) => r.data),
};
