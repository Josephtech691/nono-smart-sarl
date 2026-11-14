import api from './client';

export const ordersApi = {
  create: (data) => api.post('/orders', data).then((r) => r.data),
  list: (params) => api.get('/orders', { params }).then((r) => r.data),
  get: (id) => api.get(`/orders/${id}`).then((r) => r.data),
  track: (orderNumber, phone) => api.get(`/orders/track/${orderNumber}`, { params: { phone } }).then((r) => r.data),
  updateStatus: (id, data) => api.patch(`/orders/${id}/status`, data).then((r) => r.data),
  // Exceptionnel : l'admin valide la livraison quand le livreur n'a pas pu saisir le code (motif obligatoire).
  forceDeliver: (id, data) => api.post(`/orders/${id}/force-deliver`, data).then((r) => r.data),
  assignDriver: (id, driverId) => api.post(`/orders/${id}/assign-driver`, { driverId }).then((r) => r.data),
  autoAssignDriver: (id) => api.post(`/orders/${id}/auto-assign-driver`).then((r) => r.data),
  cancel: (id, reason) => api.post(`/orders/${id}/cancel`, { reason }).then((r) => r.data),
  review: (id, data) => api.post(`/orders/${id}/review`, data).then((r) => r.data),
  // Espèces proposées ? (compte client + plus de 2 commandes payées par Mobile Money)
  cashEligibility: () => api.get('/orders/cash-eligibility').then((r) => r.data),
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

function saveBlob(blobData, filename, type) {
  const url = window.URL.createObjectURL(new Blob([blobData], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function triggerDownload(blobData, orderNumber) {
  saveBlob(blobData, `facture-${orderNumber}.pdf`, 'application/pdf');
}

// Impression de la facture (administration) : le PDF s'ouvre dans un nouvel onglet, d'où l'on imprime.
// L'onglet est ouvert tout de suite, pendant le clic : après l'attente du PDF, les bloqueurs de fenêtres
// le refuseraient. S'il est quand même bloqué, on retombe sur le téléchargement.
export async function printInvoice(orderId, orderNumber) {
  const tab = window.open('', '_blank');
  try {
    const res = await api.get(`/orders/${orderId}/invoice.pdf`, { responseType: 'blob' });
    if (!tab) return triggerDownload(res.data, orderNumber);
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    tab.location.href = url;
    setTimeout(() => window.URL.revokeObjectURL(url), 5 * 60 * 1000);
  } catch (err) {
    if (tab) tab.close();
    throw err;
  }
  return undefined;
}

// Export CSV de la liste des commandes (mêmes filtres que la liste, sans pagination). Le fichier est servi
// derrière l'authentification : on récupère le blob puis on déclenche le téléchargement.
export async function downloadOrdersCsv(params) {
  const res = await api.get('/orders/export.csv', { params, responseType: 'blob' });
  const day = new Date().toLocaleDateString('fr-CA', { timeZone: 'Africa/Douala' });
  saveBlob(res.data, `commandes-${day}.csv`, 'text/csv;charset=utf-8');
}

export const paymentsApi = {
  initiateMtn: (orderId, phoneNumber) => api.post(`/payments/${orderId}/mtn`, { phoneNumber }).then((r) => r.data),
  initiateOrange: (orderId, phoneNumber) => api.post(`/payments/${orderId}/orange`, { phoneNumber }).then((r) => r.data),
  status: (orderId) => api.get(`/payments/${orderId}/status`).then((r) => r.data),
  // Environnement + état des clés API (bandeau d'erreur de développement, simulateur).
  config: () => api.get('/payments/config').then((r) => r.data),
  // Simulateur : disponible uniquement quand le serveur tourne en développement.
  simulate: (orderId, outcome = 'success') => api.post(`/payments/${orderId}/simulate`, { outcome }).then((r) => r.data),
  // Administration : liste filtrée + enregistrement manuel d'un encaissement / d'un remboursement.
  list: (params) => api.get('/payments', { params }).then((r) => r.data),
  markPaid: (orderId, data) => api.post(`/payments/${orderId}/mark-paid`, data).then((r) => r.data),
  markRefunded: (orderId, data) => api.post(`/payments/${orderId}/mark-refunded`, data).then((r) => r.data),
};
