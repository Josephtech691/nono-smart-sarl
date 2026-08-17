import api from './client';

export const favoritesApi = {
  list: () => api.get('/favorites').then((r) => r.data),
  add: (productId) => api.post('/favorites', { productId }).then((r) => r.data),
  remove: (productId) => api.delete(`/favorites/${productId}`).then((r) => r.data),
};

export const reviewsApi = {
  list: (params) => api.get('/reviews', { params }).then((r) => r.data),
  moderate: (id, isVisible) => api.patch(`/reviews/${id}`, { isVisible }).then((r) => r.data),
};

export const couponsApi = {
  validate: (code, subtotal) => api.post('/coupons/validate', { code, subtotal }).then((r) => r.data),
  list: () => api.get('/coupons').then((r) => r.data),
  create: (data) => api.post('/coupons', data).then((r) => r.data),
  update: (id, data) => api.patch(`/coupons/${id}`, data).then((r) => r.data),
};

export const notificationsApi = {
  list: () => api.get('/notifications').then((r) => r.data),
  markRead: (id) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.post('/notifications/read-all').then((r) => r.data),
};

export const statisticsApi = {
  dashboard: () => api.get('/statistics/dashboard').then((r) => r.data),
  sales: (days) => api.get('/statistics/sales', { params: { days } }).then((r) => r.data),
  products: () => api.get('/statistics/products').then((r) => r.data),
  zones: () => api.get('/statistics/zones').then((r) => r.data),
  profitByProduct: () => api.get('/statistics/profit-by-product').then((r) => r.data),
  topCustomers: () => api.get('/statistics/top-customers').then((r) => r.data),
  driverPerformance: () => api.get('/statistics/driver-performance').then((r) => r.data),
  stockForecast: () => api.get('/statistics/stock-forecast').then((r) => r.data),
  anomalies: () => api.get('/statistics/anomalies').then((r) => r.data),
};

export const expensesApi = {
  list: () => api.get('/expenses').then((r) => r.data),
  create: (data) => api.post('/expenses', data).then((r) => r.data),
  remove: (id) => api.delete(`/expenses/${id}`).then((r) => r.data),
  profitEstimate: (params) => api.get('/expenses/profit-estimate', { params }).then((r) => r.data),
};
