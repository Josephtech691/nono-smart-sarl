import api from './client';

export const recurringOrdersApi = {
  list: () => api.get('/recurring-orders').then((r) => r.data),
  create: (data) => api.post('/recurring-orders', data).then((r) => r.data),
  update: (id, data) => api.patch(`/recurring-orders/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/recurring-orders/${id}`).then((r) => r.data),
};
