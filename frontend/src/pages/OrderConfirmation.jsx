import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import {
  CheckCircle2, XCircle, Loader2, KeyRound, Smartphone, FileDown, AlertTriangle, RefreshCw, CalendarClock, MapPin,
} from 'lucide-react';
import { ordersApi, paymentsApi, downloadInvoice, downloadInvoiceByTracking } from '../api/orders';
import StatusTimeline from '../components/StatusTimeline';
import LiveDeliveryMap from '../components/LiveDeliveryMap';
import ContactDriverButton from '../components/ContactDriverButton';
import CheckoutStepper from '../components/CheckoutStepper';
import NeedHelp from '../components/NeedHelp';
import Loader from '../components/Loader';
import usePageMeta from '../utils/usePageMeta';
import usePaymentConfig from '../hooks/usePaymentConfig';
import { toast } from '../store/toastStore';
import { formatFCFA, formatDate, toLocalPhone, toInternationalPhone, PAYMENT_METHOD_LABELS } from '../utils/format';

const LIVE_STATUSES = ['ASSIGNED', 'PICKED_UP', 'ON_DELIVERY'];
const RETRYABLE = ['PENDING', 'FAILED'];
const RESEND_AFTER_MS = 45000;

export default function OrderConfirmation() {
  const { id } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(location.state?.order || null);
  const [error, setError] = useState('');
  const [retryPhone, setRetryPhone] = useState('');
  const [retryError, setRetryError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendCycle, setResendCycle] = useState(0);
  const orderRef = useRef(order);
  const phonePrefilledRef = useRef(false);

  usePageMeta('Commande enregistrée');
  const payCfg = usePaymentConfig();
  const simulationEnabled = !!payCfg?.simulationEnabled; // vrai uniquement quand le serveur est en développement

  const orderId = order?.id;
  const orderStatus = order?.status;
  const payMethod = order?.payment?.method;
  const payStatus = order?.payment?.status;
  const isMomo = payMethod === 'MTN_MOMO' || payMethod === 'ORANGE_MONEY';

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    if (order) return;
    ordersApi
      .get(id)
      .then(setOrder)
      .catch(async () => {
        const cached = sessionStorage.getItem('lastOrder');
        if (cached) {
          try {
            const { orderNumber, phone } = JSON.parse(cached);
            const tracked = await ordersApi.track(orderNumber, phone);
            return setOrder(tracked);
          } catch (e) {
            // tombe dans le message d'erreur ci-dessous
          }
        }
        setError("Impossible d'afficher cette commande directement. Utilisez le suivi de commande avec votre numéro et votre téléphone.");
      });
  }, [id, order]);

  // Version fraiche de la commande : par id (client connecte) ou, pour une
  // commande invitee, par numero + telephone.
  const fetchFresh = useCallback(async () => {
    const current = orderRef.current;
    if (!current) return null;
    const direct = await ordersApi.get(current.id).catch(() => null);
    if (direct) return direct;
    if (current.guestPhone) return ordersApi.track(current.orderNumber, current.guestPhone).catch(() => null);
    return null;
  }, []);

  // Sondage du statut de paiement Mobile Money jusqu'à confirmation
  useEffect(() => {
    if (!orderId || !isMomo || !['PENDING', 'PROCESSING'].includes(payStatus)) return undefined;

    const timer = setInterval(async () => {
      try {
        const { status } = await paymentsApi.status(orderId);
        if (status !== payStatus) {
          const fresh = await fetchFresh();
          if (fresh) setOrder(fresh);
          else setOrder((o) => (o ? { ...o, payment: { ...o.payment, status } } : o));
        }
      } catch (e) {
        // silencieux : on réessaiera au prochain intervalle
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [orderId, isMomo, payStatus, fetchFresh]);

  // Rafraichit la commande pendant la livraison pour suivre la position du
  // livreur et les changements de statut en direct (section 75).
  useEffect(() => {
    if (!orderId || !LIVE_STATUSES.includes(orderStatus)) return undefined;

    const timer = setInterval(async () => {
      const fresh = await fetchFresh();
      if (fresh) setOrder(fresh);
    }, 10000);

    return () => clearInterval(timer);
  }, [orderId, orderStatus, fetchFresh]);

  // Apres 45 s d'attente sans validation, on propose de renvoyer la demande.
  useEffect(() => {
    setShowResend(false);
    if (payStatus !== 'PROCESSING') return undefined;
    const timer = setTimeout(() => setShowResend(true), RESEND_AFTER_MS);
    return () => clearTimeout(timer);
  }, [payStatus, resendCycle]);

  // Pre-remplit (une seule fois) le numero Mobile Money avec celui de la commande.
  useEffect(() => {
    if (!order || phonePrefilledRef.current) return;
    const known = order.payment?.phoneNumber || order.guestPhone || '';
    if (known) {
      setRetryPhone(toLocalPhone(known));
      phonePrefilledRef.current = true;
    }
  }, [order]);

  // Simulateur de paiement (développement uniquement : le serveur répond 404 en production).
  const handleSimulate = async (outcome) => {
    try {
      await paymentsApi.simulate(order.id, outcome);
      const fresh = await fetchFresh();
      if (fresh) setOrder(fresh);
    } catch (e) {
      toast.error(e.message || 'Simulation indisponible');
    }
  };

  const handleInvoice = async () => {
    try {
      if (order.customerId) await downloadInvoice(order.id, order.orderNumber);
      else await downloadInvoiceByTracking(order.orderNumber, order.guestPhone);
    } catch (e) {
      toast.error('Facture indisponible pour le moment');
    }
  };

  const retryPayment = async () => {
    setRetryError('');
    const local = toLocalPhone(retryPhone);
    if (!/^6\d{8}$/.test(local)) {
      setRetryError('Numéro Mobile Money invalide (9 chiffres, ex : 6XXXXXXXX).');
      return;
    }
    setRetrying(true);
    try {
      const international = toInternationalPhone(local);
      const init = payMethod === 'MTN_MOMO'
        ? await paymentsApi.initiateMtn(order.id, international)
        : await paymentsApi.initiateOrange(order.id, international);
      // Orange Money : redirection vers la page de paiement Orange.
      if (init?.paymentUrl) {
        window.location.assign(init.paymentUrl);
        return;
      }
      setOrder((o) => ({ ...o, payment: { ...o.payment, status: 'PROCESSING', phoneNumber: international } }));
      setResendCycle((c) => c + 1);
      toast.success(init?.simulated ? 'Demande simulée (mode développement).' : 'Demande envoyée. Validez-la sur votre téléphone.');
    } catch (err) {
      setRetryError(err.message || "Impossible d'envoyer la demande de paiement. Réessayez dans un instant.");
    } finally {
      setRetrying(false);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
        <p className="text-ink/70">{error}</p>
        <Link to="/suivi-commande" className="btn-primary mt-5 inline-flex">Suivre ma commande</Link>
      </div>
    );
  }

  if (!order) return <Loader label="Chargement de votre commande..." />;

  const cancelled = order.status === 'CANCELLED';
  const methodLabel = PAYMENT_METHOD_LABELS[payMethod];
  const awaitingValidation = !cancelled && isMomo && payStatus === 'PROCESSING';
  const needsPaymentAction = !cancelled && isMomo && RETRYABLE.includes(payStatus);

  // Fonction (et non composant) pour ne pas remonter le champ a chaque rendu.
  const renderRetryForm = (buttonLabel) => (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          retryPayment();
        }}
        className="mt-4 flex flex-col gap-2 text-left sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className="label" htmlFor="retryPhone">Numéro {methodLabel}</label>
          <input
            id="retryPhone"
            className="input"
            type="tel"
            inputMode="tel"
            placeholder="6XXXXXXXX"
            value={retryPhone}
            onChange={(e) => setRetryPhone(e.target.value)}
          />
        </div>
        <button type="submit" disabled={retrying} className="btn-primary">
          {retrying ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} {buttonLabel}
        </button>
      </form>
      {retryError && <p className="mt-2 text-left text-sm text-red-700" role="alert">{retryError}</p>}
    </>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <CheckoutStepper current={3} />

      <div className="mt-8 flex flex-col items-center text-center animate-fade-up">
        <span className={`flex h-16 w-16 items-center justify-center rounded-full ${cancelled ? 'bg-red-100 text-red-600' : 'bg-brand-500/15 text-brand-700'}`}>
          {cancelled ? <XCircle size={32} /> : <CheckCircle2 size={32} />}
        </span>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">{cancelled ? 'Commande annulée' : 'Commande enregistrée !'}</h1>
        <p className="mt-1 text-ink/60">Numéro de commande</p>
        <p className="font-display text-xl font-bold text-pine-900">{order.orderNumber}</p>
      </div>

      {!cancelled && isMomo && payStatus === 'PAID' && (
        <div className="mt-8 flex items-center justify-center gap-2 rounded-xl2 border border-brand-600/20 bg-brand-500/10 px-5 py-3 text-sm font-medium text-brand-700">
          <CheckCircle2 size={18} /> Paiement {methodLabel} reçu : {formatFCFA(order.payment?.amount ?? order.total)}
        </div>
      )}

      {awaitingValidation && (
        <div className="mt-8 rounded-xl2 border border-amber-200 bg-amber-50 p-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <Smartphone size={26} className="text-amber-600" />
            <p className="font-medium text-amber-800">
              {payMethod === 'ORANGE_MONEY'
                ? 'Finalisez le paiement sur la page Orange Money. Si vous l’avez fermée, relancez-la ci-dessous.'
                : `Validez la demande de paiement ${methodLabel} reçue sur votre téléphone${order.payment?.phoneNumber ? ` (${toLocalPhone(order.payment.phoneNumber)})` : ''}.`}
            </p>
            <p className="flex items-center gap-2 text-sm text-amber-700">
              <Loader2 size={14} className="animate-spin" /> En attente de confirmation...
            </p>
          </div>
          {showResend && (
            <div className="mt-4 border-t border-amber-200 pt-4">
              <p className="text-sm text-amber-800">Rien reçu ? Vérifiez votre numéro puis renvoyez la demande.</p>
              {renderRetryForm('Renvoyer la demande')}
            </div>
          )}
          {simulationEnabled && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-dashed border-amber-300 pt-3">
              <span className="w-full text-xs font-medium text-amber-700">Mode développement — simulateur de paiement</span>
              <button type="button" onClick={() => handleSimulate('success')} className="btn-secondary !py-1.5 text-xs">Simuler un paiement réussi</button>
              <button type="button" onClick={() => handleSimulate('failure')} className="btn-secondary !py-1.5 text-xs">Simuler un échec</button>
            </div>
          )}
        </div>
      )}

      {needsPaymentAction && (
        <div className="mt-8 rounded-xl2 border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={22} className="mt-0.5 shrink-0 text-red-600" />
            <div>
              <p className="font-medium text-red-800">
                {payStatus === 'PENDING' ? "Le paiement n'a pas encore été lancé." : "Le paiement n'a pas abouti."}
              </p>
              <p className="text-sm text-red-700">
                Votre commande est bien enregistrée. Relancez la demande de paiement {methodLabel} ci-dessous ou contactez-nous.
              </p>
            </div>
          </div>
          {renderRetryForm('Réessayer le paiement')}
        </div>
      )}

      {order.delivery?.confirmationCode && order.status !== 'DELIVERED' && !cancelled && (
        <div className="mt-6 flex items-center justify-center gap-3 rounded-xl2 border border-line bg-mist/60 px-5 py-4">
          <KeyRound size={20} className="text-pine-800" />
          <p className="text-sm text-ink/70">
            Code de confirmation à donner au livreur : <span className="font-display text-lg font-bold text-ink">{order.delivery.confirmationCode}</span>
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-4 font-display font-semibold">Suivi de la commande</h2>
            <StatusTimeline status={order.status} />
          </div>
          <LiveDeliveryMap order={order} />
          <ContactDriverButton order={order} className="w-full" />
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 font-display font-semibold">Détails</h2>
            <ul className="space-y-1.5 text-sm text-ink/70">
              {order.items.map((it) => (
                <li key={it.id} className="flex justify-between">
                  <span>{it.name} × {it.quantity}</span>
                  <span>{formatFCFA(it.total)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between text-ink/60"><span>Sous-total</span><span>{formatFCFA(order.subtotal)}</span></div>
              <div className="flex justify-between text-ink/60"><span>Livraison</span><span>{formatFCFA(order.deliveryFee)}</span></div>
              {order.discount > 0 && <div className="flex justify-between text-brand-700"><span>Réduction</span><span>-{formatFCFA(order.discount)}</span></div>}
              <div className="flex justify-between border-t border-line pt-2 font-display font-bold text-ink"><span>Total</span><span>{formatFCFA(order.total)}</span></div>
            </div>
            <button onClick={handleInvoice} className="btn-secondary mt-4 w-full !py-2 text-sm">
              <FileDown size={15} /> Télécharger la facture (PDF)
            </button>
          </div>
          <div className="card p-5 text-sm text-ink/70">
            <h2 className="mb-2 font-display font-semibold text-ink">Livraison</h2>
            <p className="flex items-start gap-2">
              <MapPin size={15} className="mt-0.5 shrink-0 text-ink/40" />
              <span>{order.address?.district}{order.address?.landmark ? ` — ${order.address.landmark}` : ''}</span>
            </p>
            {order.scheduledAt && (
              <p className="mt-1.5 flex items-start gap-2">
                <CalendarClock size={15} className="mt-0.5 shrink-0 text-ink/40" />
                <span>Programmée : {formatDate(order.scheduledAt)}{order.notes ? ` · ${order.notes}` : ''}</span>
              </p>
            )}
            <p className="mt-1.5 text-ink/50">Paiement : {methodLabel}</p>
          </div>
        </div>
      </div>

      <NeedHelp orderNumber={order.orderNumber} className="mt-8" />

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/produits" className="btn-secondary">Continuer mes achats</Link>
        <Link to={order.customerId ? `/compte/commandes/${order.id}` : `/suivi-commande/${order.orderNumber}`} className="btn-primary">Suivre ma commande</Link>
      </div>
    </div>
  );
}
