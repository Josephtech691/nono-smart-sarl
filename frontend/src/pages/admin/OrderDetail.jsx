import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, BadgeCheck, Ban, Check, FileDown, KeyRound, MapPin, MessageCircle, PackageSearch, Phone, Printer, Sparkles, Undo2,
} from 'lucide-react';
import { ordersApi, downloadInvoice, printInvoice } from '../../api/orders';
import { driversApi } from '../../api/logistics';
import LiveDeliveryMap from '../../components/LiveDeliveryMap';
import Loader from '../../components/Loader';
import EmptyState from '../../components/EmptyState';
import PaymentBadge from '../../components/PaymentBadge';
import StatusBadge from '../../components/StatusBadge';
import { DeliveryStatusBadge } from '../../components/driver/DeliveryCard';
import { AVAILABILITY_LABELS } from '../../components/driver/AvailabilityPicker';
import Modal from '../../components/admin/Modal';
import PaymentActionModal from '../../components/admin/PaymentActionModal';
import { toast } from '../../store/toastStore';
import { formatDate, formatFCFA, formatPhone, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, whatsappUrl } from '../../utils/format';
import { canAssignDriver, needsRefund, NEXT_STATUSES, orderCustomerName, orderCustomerPhone, STATUSES_WITH_DRIVER } from '../../utils/orders';
import usePageMeta from '../../utils/usePageMeta';

const CANCELLABLE = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'ASSIGNED'];
const ISSUE_NOTE = /^Probleme signale par le livreur\s*:\s*/i;

// Dernier problème signalé par le livreur (il est écrit dans l'historique de la commande).
function lastIssue(order) {
  const entry = [...(order.statusHistory || [])].reverse().find((h) => ISSUE_NOTE.test(h.note || ''));
  return entry ? entry.note.replace(ISSUE_NOTE, '') : '';
}

const driverName = (driver) => (driver?.user ? `${driver.user.firstName} ${driver.user.lastName}`.trim() : '');

// Fenêtre « Annuler la commande » : motif facultatif, avec les conséquences (livreur prévenu, remboursement).
function CancelModal({ order, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const paid = order.payment?.status === 'PAID';

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await ordersApi.cancel(order.id, reason.trim() || undefined);
      toast.success('Commande annulée');
      onDone();
    } catch (err) {
      setError(err.message || "Annulation impossible, réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      icon={Ban}
      title={`Annuler la commande ${order.orderNumber} ?`}
      description="Le stock réservé est libéré et le client est prévenu. Cette action est définitive."
    >
      <form onSubmit={submit} className="mt-4 space-y-4">
        {order.delivery?.driverId && <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">Le livreur assigné sera prévenu que la livraison est annulée.</p>}
        {paid && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="cancel-refund-warning">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
            <span>Le paiement de {formatFCFA(order.payment.amount)} a déjà été encaissé : pensez à rembourser le client, puis à l'enregistrer sur cette fiche.</span>
          </p>
        )}
        <div>
          <label htmlFor="cancel-reason" className="label">Motif (facultatif)</label>
          <textarea id="cancel-reason" rows={3} className="input resize-none" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex : produit indisponible, client injoignable…" />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary !py-3">
            Garder la commande
          </button>
          <button type="submit" disabled={busy} className="btn-primary !bg-red-600 !py-3 hover:!bg-red-700">
            {busy ? 'Annulation…' : 'Annuler la commande'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loadError, setLoadError] = useState(null); // { notFound, message }
  const [drivers, setDrivers] = useState([]);
  const [driversFailed, setDriversFailed] = useState(false);
  const [statusChoice, setStatusChoice] = useState('');
  const [driverChoice, setDriverChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [payModal, setPayModal] = useState(null); // 'paid' | 'refund'
  const [cancelOpen, setCancelOpen] = useState(false);

  usePageMeta(order ? `Commande ${order.orderNumber}` : 'Commande');

  // Charge la commande et remet les deux listes de choix sur la situation réelle (statut actuel, livreur assigné).
  const load = useCallback(async () => {
    try {
      const data = await ordersApi.get(id);
      setOrder(data);
      setLoadError(null);
      setStatusChoice(data.status);
      setDriverChoice(data.delivery?.driverId || '');
      return data;
    } catch (err) {
      setLoadError({ notFound: err.status === 404, message: err.message || 'Chargement impossible' });
      return null;
    }
  }, [id]);

  useEffect(() => {
    setOrder(null);
    setLoadError(null);
    load();
    driversApi
      .list()
      .then((list) => {
        setDrivers(list);
        setDriversFailed(false);
      })
      .catch(() => setDriversFailed(true));
  }, [id, load]);

  if (loadError && !order) {
    return (
      <EmptyState
        icon={PackageSearch}
        title={loadError.notFound ? 'Commande introuvable' : 'Chargement impossible'}
        description={loadError.notFound ? "Cette commande n'existe pas ou a été supprimée." : loadError.message}
        action={
          loadError.notFound ? (
            <Link to="/admin/commandes" className="btn-primary mt-2">
              Toutes les commandes
            </Link>
          ) : (
            <button type="button" onClick={load} className="btn-primary mt-2">
              Réessayer
            </button>
          )
        }
      />
    );
  }
  if (!order) return <Loader />;

  const delivery = order.delivery;
  const payment = order.payment;
  const name = orderCustomerName(order);
  const phone = orderCustomerPhone(order);
  const whatsapp = whatsappUrl(phone, `Bonjour ${name.split(' ')[0]}, c'est Fresh Fish au sujet de votre commande ${order.orderNumber}.`);

  const nextStatuses = NEXT_STATUSES[order.status] || [];
  const canAssign = canAssignDriver(order);
  const currentDriverId = delivery?.driverId || '';
  const statusChanged = statusChoice !== order.status;
  const driverChanged = driverChoice !== currentDriverId;
  const finished = order.status === 'DELIVERED' || order.status === 'CANCELLED';
  // Livraison signalée « non livrée » par le livreur : on peut la relancer, avec le même livreur ou un autre.
  const issue = delivery?.status === 'FAILED' && !finished ? lastIssue(order) || 'motif non précisé' : null;
  const relaunch = issue !== null;

  // Livreurs proposés : actifs et non suspendus, plus le livreur déjà assigné (pour qu'il reste affiché même s'il est indisponible).
  const eligible = drivers.filter((d) => d.status !== 'SUSPENDED' && d.user?.isActive !== false);
  const driverOptions = eligible.some((d) => d.id === currentDriverId) || !currentDriverId ? eligible : [...eligible, ...drivers.filter((d) => d.id === currentDriverId)];

  // Pourquoi « Enregistrer » est bloqué : même règles que le serveur, dites avant l'envoi.
  let hint = '';
  if (statusChanged && statusChoice === 'ASSIGNED' && !driverChoice) hint = 'Choisissez le livreur à qui assigner la commande.';
  else if (statusChanged && driverChanged && driverChoice && !STATUSES_WITH_DRIVER.includes(statusChoice)) {
    hint = 'Le livreur se choisit en passant la commande à « Prête » ou « Assignée ». Enregistrez d\'abord le statut, ou laissez le statut actuel pour changer seulement le livreur.';
  }
  const canSave = !busy && !hint && (statusChanged || (Boolean(driverChoice) && canAssign && (driverChanged || relaunch)));

  const save = async () => {
    setBusy(true);
    try {
      if (statusChanged) {
        const body = { status: statusChoice };
        if (driverChoice && STATUSES_WITH_DRIVER.includes(statusChoice)) body.driverId = driverChoice;
        await ordersApi.updateStatus(id, body);
      } else {
        await ordersApi.assignDriver(id, driverChoice);
      }
      const fresh = await load();
      if (statusChanged && statusChoice === 'READY' && !driverChoice && fresh) {
        toast.success(fresh.status === 'ASSIGNED' ? 'Commande prête : livreur assigné automatiquement' : 'Commande prête : aucun livreur disponible, assignez-en un à la main');
      } else if (!statusChanged && relaunch) {
        toast.success('Livraison relancée');
      } else {
        toast.success('Commande mise à jour');
      }
    } catch (err) {
      toast.error(err.message || 'Mise à jour impossible');
    } finally {
      setBusy(false);
    }
  };

  const autoAssign = async () => {
    setBusy(true);
    try {
      await ordersApi.autoAssignDriver(id);
      toast.success('Livreur assigné automatiquement');
      await load();
    } catch (err) {
      toast.error(err.message || 'Aucun livreur disponible');
    } finally {
      setBusy(false);
    }
  };

  const handleInvoice = async () => {
    try {
      await downloadInvoice(id, order.orderNumber);
    } catch {
      toast.error('Facture indisponible');
    }
  };

  const handlePrint = async () => {
    try {
      await printInvoice(id, order.orderNumber);
    } catch {
      toast.error('Facture indisponible');
    }
  };

  const refundDue = needsRefund(order);
  const canMarkPaid = payment && ['PENDING', 'PROCESSING', 'FAILED'].includes(payment.status) && order.status !== 'CANCELLED';
  const payTarget = payment ? { orderId: order.id, orderNumber: order.orderNumber, amount: payment.amount, method: payment.method, orderStatus: order.status } : null;
  const mobileMoneyToCheck = canMarkPaid && payment.method !== 'CASH' && ['PENDING', 'PROCESSING'].includes(payment.status);

  return (
    <div>
      <Link to="/admin/commandes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink/60 hover:text-ink">
        <ArrowLeft size={15} /> Toutes les commandes
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{order.orderNumber}</h1>
          <p className="text-sm text-ink/50">Passée le {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {payment && (refundDue ? <span className="badge bg-red-100 text-red-700">À rembourser</span> : <PaymentBadge status={payment.status} method={payment.method} />)}
          <StatusBadge status={order.status} />
        </div>
      </div>

      {issue !== null && (
        <div role="alert" data-testid="issue-banner" className="mt-5 flex items-start gap-3 rounded-xl2 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
          <div>
            <p className="font-semibold">Problème de livraison signalé{driverName(delivery.driver) ? ` par ${driverName(delivery.driver)}` : ''}</p>
            <p className="mt-0.5">Motif : {issue}. Relancez la livraison en choisissant un livreur ci-dessous (le même ou un autre), ou annulez la commande.</p>
          </div>
        </div>
      )}

      {refundDue && (
        <div data-testid="refund-banner" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl2 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="flex items-start gap-2">
            <Undo2 size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
            <span>Cette commande est annulée mais {formatFCFA(payment.amount)} avaient été encaissés. Remboursez le client, puis enregistrez-le.</span>
          </p>
          <button type="button" onClick={() => setPayModal('refund')} className="btn-secondary !border-amber-600 !px-4 !py-2 text-sm !text-amber-900 hover:!bg-amber-100">
            Marquer comme remboursé
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-5">
            <h2 className="mb-3 font-display font-semibold">Articles</h2>
            <ul className="space-y-1.5 text-sm text-ink/70">
              {order.items.map((it) => (
                <li key={it.id} className="flex justify-between gap-3">
                  <span>{it.name} × {it.quantity} ({formatFCFA(it.unitPrice)}/u)</span>
                  <span className="shrink-0 font-medium text-ink">{formatFCFA(it.total)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between text-ink/60"><span>Sous-total</span><span>{formatFCFA(order.subtotal)}</span></div>
              <div className="flex justify-between text-ink/60"><span>Livraison{order.deliveryZone?.name ? ` (${order.deliveryZone.name})` : ''}</span><span>{formatFCFA(order.deliveryFee)}</span></div>
              {order.discount > 0 && (
                <div className="flex justify-between text-brand-700"><span>Réduction{order.coupon?.code ? ` (${order.coupon.code})` : ''}</span><span>-{formatFCFA(order.discount)}</span></div>
              )}
              <div className="flex justify-between border-t border-line pt-2 font-display font-bold text-ink"><span>Total</span><span>{formatFCFA(order.total)}</span></div>
            </div>
            {order.notes && <p className="mt-3 rounded-lg bg-mist px-3 py-2 text-sm text-ink/70"><span className="font-medium text-ink">Note du client :</span> {order.notes}</p>}
            {order.scheduledAt && (
              <p className="mt-2 text-sm text-ink/70"><span className="font-medium text-ink">Livraison souhaitée :</span> {formatDate(order.scheduledAt)}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={handleInvoice} className="btn-secondary !py-2 text-sm">
                <FileDown size={15} /> Télécharger la facture (PDF)
              </button>
              <button type="button" onClick={handlePrint} className="btn-secondary !py-2 text-sm">
                <Printer size={15} /> Imprimer la facture
              </button>
            </div>
          </div>

          <LiveDeliveryMap order={order} />

          <div className="card p-5" data-testid="update-panel">
            <h2 className="mb-1 font-display font-semibold">Mettre à jour la commande</h2>
            {finished ? (
              <p className="text-sm text-ink/50">{order.status === 'DELIVERED' ? 'Commande livrée : plus aucun changement possible.' : 'Commande annulée : plus aucun changement possible.'}</p>
            ) : (
              <>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="status-choice" className="label">Statut</label>
                    <select id="status-choice" className="input" value={statusChoice} disabled={busy || nextStatuses.length === 0} onChange={(e) => setStatusChoice(e.target.value)}>
                      <option value={order.status}>{ORDER_STATUS_LABELS[order.status]} (actuel)</option>
                      {nextStatuses.map((s) => (
                        <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="driver-choice" className="label">Livreur</label>
                    <select
                      id="driver-choice"
                      className="input"
                      value={driverChoice}
                      disabled={busy || !canAssign || driversFailed}
                      onChange={(e) => setDriverChoice(e.target.value)}
                      title={canAssign ? undefined : "Le livreur se choisit une fois la commande confirmée, tant qu'elle n'est pas partie."}
                    >
                      {!currentDriverId && <option value="">Choisir un livreur…</option>}
                      {driverOptions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {driverName(d)} ({formatPhone(d.user?.phone)}) — {AVAILABILITY_LABELS[d.status] || d.status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {driversFailed && <p className="mt-2 text-xs text-red-700">La liste des livreurs n'a pas pu être chargée : rechargez la page pour assigner une livraison.</p>}
                {hint && <p role="status" data-testid="update-hint" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{hint}</p>}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={save} disabled={!canSave} className="btn-primary !py-2.5 text-sm">
                    <Check size={16} /> {relaunch && !statusChanged ? 'Relancer la livraison' : 'Enregistrer'}
                  </button>
                  {canAssign && (
                    <button type="button" disabled={busy} onClick={autoAssign} className="btn-secondary !py-2.5 text-sm" title="Assigne automatiquement le livreur disponible le moins chargé">
                      <Sparkles size={14} /> Auto-assigner
                    </button>
                  )}
                  {CANCELLABLE.includes(order.status) && (
                    <button type="button" disabled={busy} onClick={() => setCancelOpen(true)} className="btn-secondary ml-auto !border-red-300 !py-2.5 text-sm !text-red-600 hover:!bg-red-50">
                      <Ban size={15} /> Annuler la commande
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {order.statusHistory?.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-3 font-display font-semibold">Historique</h2>
              <ul className="space-y-2.5 text-sm" data-testid="history">
                {order.statusHistory.map((h) => (
                  <li key={h.id} className="flex justify-between gap-3">
                    <span className="min-w-0 text-ink/70">
                      <span className="font-medium text-ink">{ORDER_STATUS_LABELS[h.status] || h.status}</span>
                      {h.note && <span className="block break-words text-xs text-ink/50">{h.note}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-ink/40">{formatDate(h.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 font-display font-semibold">Client</h2>
            <p className="text-sm font-medium text-ink">{name}</p>
            <p className="text-xs text-ink/45">{order.customer ? 'Compte client' : 'Commande sans compte'}</p>
            {phone && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <a href={`tel:${phone}`} className="flex items-center gap-2 text-sm text-brand-700 hover:underline"><Phone size={14} /> {formatPhone(phone)}</a>
                {whatsapp && (
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-brand-700 hover:underline">
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-display font-semibold">Livraison</h2>
            <p className="flex items-start gap-2 text-sm text-ink/70">
              <MapPin size={15} className="mt-0.5 shrink-0" />
              <span>{[order.address?.district, order.address?.landmark].filter(Boolean).join(' — ') || 'Adresse non précisée'}</span>
            </p>
            {order.address?.fullName && order.address.fullName !== name && (
              <p className="mt-1 text-xs text-ink/50">Destinataire : {order.address.fullName}{order.address.phone ? ` · ${formatPhone(order.address.phone)}` : ''}</p>
            )}
            {order.address?.instructions && <p className="mt-1 text-xs italic text-ink/50">"{order.address.instructions}"</p>}

            <div className="mt-3 border-t border-line pt-3 text-sm">
              {delivery?.driver ? (
                <div className="space-y-1" data-testid="assigned-driver">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink">{driverName(delivery.driver)}</span>
                    <DeliveryStatusBadge delivery={{ ...delivery, order }} />
                  </div>
                  {delivery.driver.user?.phone && (
                    <a href={`tel:${delivery.driver.user.phone}`} className="flex items-center gap-2 text-brand-700 hover:underline"><Phone size={14} /> {formatPhone(delivery.driver.user.phone)}</a>
                  )}
                </div>
              ) : (
                <p className="text-ink/50">Aucun livreur assigné pour le moment.</p>
              )}
              {delivery?.confirmationCode && (
                <p className="mt-3 flex items-center gap-2 text-ink/70"><KeyRound size={15} /> Code de livraison : <span className="font-display font-bold tracking-widest text-ink">{delivery.confirmationCode}</span></p>
              )}
            </div>
          </div>

          <div className="card p-5" data-testid="payment-card">
            <h2 className="mb-3 font-display font-semibold">Paiement</h2>
            {payment ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-ink/70">{PAYMENT_METHOD_LABELS[payment.method] || payment.method}</p>
                  {refundDue ? <span className="badge bg-red-100 text-red-700">À rembourser</span> : <PaymentBadge status={payment.status} method={payment.method} />}
                </div>
                <p className="mt-1 font-display text-lg font-bold text-ink">{formatFCFA(payment.amount)}</p>
                {payment.phoneNumber && payment.method !== 'CASH' && <p className="mt-1 text-xs text-ink/50">Numéro Mobile Money : {formatPhone(payment.phoneNumber)}</p>}
                {payment.transactionRef && <p className="mt-1 break-all text-xs text-ink/50">Référence : <span className="font-medium text-ink/70">{payment.transactionRef}</span></p>}
                {payment.method === 'CASH' && delivery?.cashReceived != null && <p className="mt-1 text-xs text-ink/50">Espèces encaissées par le livreur : {formatFCFA(delivery.cashReceived)}</p>}

                {mobileMoneyToCheck && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Paiement à vérifier : dès que vous avez reçu l'argent (message MTN / Orange), enregistrez-le.
                  </p>
                )}
                {canMarkPaid && (
                  <button type="button" onClick={() => setPayModal('paid')} className="btn-primary mt-3 w-full !py-2.5 text-sm">
                    <BadgeCheck size={16} /> {payment.method === 'CASH' ? 'Espèces encaissées' : 'Marquer comme payé'}
                  </button>
                )}
                {refundDue && (
                  <button type="button" onClick={() => setPayModal('refund')} className="btn-secondary mt-3 w-full !py-2.5 text-sm">
                    <Undo2 size={16} /> Marquer comme remboursé
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-ink/50">Aucun paiement enregistré.</p>
            )}
          </div>
        </div>
      </div>

      <PaymentActionModal
        mode={payModal}
        target={payModal ? payTarget : null}
        onClose={() => setPayModal(null)}
        onDone={() => {
          setPayModal(null);
          load();
        }}
      />
      {cancelOpen && (
        <CancelModal
          order={order}
          onClose={() => setCancelOpen(false)}
          onDone={() => {
            setCancelOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
