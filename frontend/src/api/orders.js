import api from './client';

export const ordersApi = {
  create: (data) => api.post('/orders', data).then((r) => r.data),
  list: (params) => api.get('/orders', { params }).then((r) => r.data),
  get: (id) => api.get(`/orders/${id}`).then((r) => r.data),
  track: (orderNumber, phone) => api.get(`/orders/track/${orderNumber}`, { params: { phone } }).then((r) => r.data),
  updateStatus: (id, data) => api.patch(`/orders/${id}/status`, data).then((r) => r.data),
  assignDriver: (id, driverId) => api.post(`/orders/${id}/assign-driver`, { driverId }).then((r) => r.data),
  autoAssignDriver: (id) => api.post(`/orders/${id}/auto-assign-driver`).then((r) => r.data),
  cancel: (id, reason) => api.post(`/orders/${id}/cancel`, { reason }).then((r) => r.data),
  review: (id, data) => api.post(`/orders/${id}/review`, data).then((r) => r.data),
};

// Le PDF est servi derriere l'authentification. On recupere le blob (le
// token est deja attache automatiquement par l'intercepteur de ./client)
// puis on declenche le telechargement cote navigateur.
export async function downloadInvoice(orderId, orderNumber) {
  const res = await api.get(`/orders/${orderId}/invoice.pdf`, { responseType: 'blob' });
  triggerDownload(res.data, orderNumber);
}

// Variante pour une commande invitee suivie par numero + telephone (pas de token).
export async function downloadInvoiceByTracking(orderNumber, phone) {
  const res = await api.get(`/orders/track/${orderNumber}/invoice.pdf`, { params: { phone }, responseType: 'blob' });
  triggerDownload(res.data, orderNumber);
}

function triggerDownload(blobData, orderNumber) {
  const url = window.URL.createObjectURL(new Blob([blobData], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `facture-${orderNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export const paymentsApi = {
  initiateMtn: (orderId, phoneNumber) => api.post(`/payments/${orderId}/mtn`, { phoneNumber }).then((r) => r.data),
  initiateOrange: (orderId, phoneNumber) => api.post(`/payments/${orderId}/orange`, { phoneNumber }).then((r) => r.data),
  status: (orderId) => api.get(`/payments/${orderId}/status`).then((r) => r.data),
  simulate: (orderId) => api.post(`/payments/${orderId}/simulate`).then((r) => r.data),
};
