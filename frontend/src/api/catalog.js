import api from './client';

export const categoriesApi = {
  list: (params) => api.get('/categories', { params }).then((r) => r.data),
  create: (data) => api.post('/categories', data).then((r) => r.data),
  update: (id, data) => api.patch(`/categories/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/categories/${id}`).then((r) => r.data),
};

export const productsApi = {
  list: (params) => api.get('/products', { params }).then((r) => r.data),
  get: (idOrSlug) => api.get(`/products/${idOrSlug}`).then((r) => r.data),
  recommendations: (id) => api.get(`/products/${id}/recommendations`).then((r) => r.data),
  create: (data) => api.post('/products', data).then((r) => r.data),
  update: (id, data) => api.patch(`/products/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/products/${id}`).then((r) => r.data),
  adjustStock: (id, data) => api.patch(`/products/${id}/stock`, data).then((r) => r.data),
};
