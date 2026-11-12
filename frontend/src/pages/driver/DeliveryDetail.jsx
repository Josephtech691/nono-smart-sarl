import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Phone, MessageCircle, Navigation, MapPin, Clock, StickyNote, PackageCheck, CheckCircle2,
  AlertTriangle, Banknote, Smartphone, PackageSearch, Check,
} from 'lucide-react';
import { driversApi } from '../../api/logistics';
import { useDriverStore } from '../../store/driverStore';
import { DeliveryStatusBadge } from '../../components/driver/DeliveryCard';
import ReportIssueModal from '../../components/ReportIssueModal';
import EmptyState from '../../components/EmptyState';
import Loader from '../../components/Loader';
import { toast } from '../../store/toastStore';
import usePageMeta from '../../utils/usePageMeta';
import { cashDue, customerName, customerPhone, dayKey, dayLabel, initialsOf, mapUrl, paymentSummary, scheduledLabel, telHref, timeLabel } from '../../utils/delivery';
import { formatFCFA, whatsappUrl } from '../../utils/format';

const STEPS = [
  { key: 'todo', label: 'À livrer' },
  { key: 'picked', label: 'Récupérée' },
  { key: 'route', label: 'En route' },
  { key: 'done', label: 'Livrée' },
];
const STEP_INDEX = { PENDING: 0, ASSIGNED: 0, PICKED_UP: 1, ON_ROUTE: 2, DELIVERED: 3 };

function Stepper({ status }) {
  const current = STEP_INDEX[status];
  if (current === undefined) return null; // livraison sans suite : pas de progression à montrer
  return (
    <ol aria-label="Progression de la livraison" className="flex items-start">
      {STEPS.map((step, i) => {
        const done = i < current || status === 'DELIVERED';
        const isCurrent = i === current && status !== 'DELIVERED';
        return (
          <li key={step.key} aria-current={isCurrent ? 'step' : undefined} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && <span aria-hidden="true" className={`absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2 ${i <= current ? 'bg-brand-600' : 'bg-line'}`} />}
            <span
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                done ? 'bg-brand-600 text-white' : isCurrent ? 'bg-pine-900 text-brand-500 ring-4 ring-brand-500/20' : 'bg-white text-ink/40 ring-2 ring-line'
              }`}
            >
              {done ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className={`mt-1.5 text-[11px] leading-tight ${isCurrent ? 'font-semibold text-ink' : 'text-ink/50'}`}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function PaymentPanel({ delivery }) {
  const { order } = delivery;
  const pay = paymentSummary(order, delivery);
  const done = delivery.status === 'DELIVERED';

  if (pay.kind === 'cash') {
    if (done) {
      return (
        <div className="flex items-center gap-3 rounded-xl2 bg-mist px-4 py-3">
          <Banknote size={22} className="shrink-0 text-brand-700" />
          <div>
            <p className="text-xs text-ink/55">Espèces encaissées</p>
            <p className="font-display text-lg font-bold text-ink">{formatFCFA(delivery.cashReceived ?? 0)}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-3 rounded-xl2 border border-amber-200 bg-amber-50 px-4 py-3">
        <Banknote size={24} className="shrink-0 text-amber-700" />
        <div>
          <p className="text-xs font-medium text-amber-800">Espèces à encaisser à la livraison</p>
          <p className="font-display text-2xl font-bold text-ink" data-testid="cash-due">{formatFCFA(cashDue(delivery))}</p>
        </div>
      </div>
    );
  }
  if (pay.kind === 'paid') {
    return (
      <div className="flex items-center gap-3 rounded-xl2 bg-brand-500/10 px-4 py-3">
        <Smartphone size={22} className="shrink-0 text-brand-700" />
        <div>
          <p className="text-sm font-semibold text-brand-700">{pay.label}</p>
          <p className="text-xs text-ink/60">Rien à encaisser : la commande est déjà payée.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-xl2 border border-amber-300 bg-amber-50 px-4 py-3">
      <AlertTriangle size={22} className="mt-0.5 shrink-0 text-amber-600" />
      <div>
        <p className="text-sm font-semibold text-amber-900">{pay.label}</p>
        <p className="text-xs text-amber-800/80">
          {done ? "Ce paiement n'avait pas été confirmé au moment de la livraison." : "Contactez l'administration avant de remettre la commande : le paiement n'est pas encore confirmé."}
        </p>
      </div>
    </div>
  );
}

export default function DriverDeliveryDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const refreshStore = useDriverStore((s) => s.refresh);
  const [delivery, setDelivery] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const seq = useRef(0); // une réponse plus ancienne ne doit jamais écraser une plus récente
  const hasData = useRef(false);

  usePageMeta(delivery ? `Livraison ${delivery.order.orderNumber}` : 'Livraison');

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const data = await driversApi.getDelivery(orderId);
      if (mine !== seq.current) return;
      hasData.current = true;
      setDelivery(data);
      setLoadError('');
    } catch (err) {
      if (mine !== seq.current) return;
      if (err.status === 404) {
        // Introuvable ou réassignée à un autre livreur.
        hasData.current = false;
        setDelivery(null);
        setLoadError('not-found');
      } else if (!hasData.current) {
        setLoadError(err.message || 'Chargement impossible');
      } // sinon : trou de réseau, on garde ce qui est affiché
    }
  }, [orderId]);

  useEffect(() => {
    hasData.current = false;
    setDelivery(null);
    setLoadError('');
    load();
    // Si l'administration annule ou réassigne la livraison pendant que le livreur la consulte.
    const tick = () => {
      if (document.visibilityState === 'visible') load();
    };
    const timer = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  const act = async (request, successMessage) => {
    setBusy(true);
    try {
      const next = await request();
      seq.current += 1;
      hasData.current = true;
      setDelivery(next);
      if (successMessage) toast.success(successMessage);
      refreshStore();
    } catch (err) {
      toast.error(err.message || 'Action impossible');
      load(); // la livraison a peut-être changé entre-temps (annulée, réassignée…)
    } finally {
      setBusy(false);
    }
  };

  const reportIssue = async ({ reason, note }) => {
    await driversApi.reportIssue(orderId, { reason, note });
    toast.success("Problème signalé à l'administration");
    setIssueOpen(false);
    await load();
    refreshStore();
  };

  if (!delivery) {
    if (loadError === 'not-found') {
      return (
        <EmptyState
          icon={PackageSearch}
          title="Livraison introuvable"
          description="Elle n'existe pas ou n'est plus assignée à votre compte."
          action={<Link to="/livreur/livraisons" className="btn-primary mt-2">Mes livraisons</Link>}
        />
      );
    }
    if (loadError) {
      return (
        <EmptyState
          icon={PackageSearch}
          title="Chargement impossible"
          description={loadError}
          action={<button type="button" className="btn-secondary mt-2" onClick={load}>Réessayer</button>}
        />
      );
    }
    return <Loader />;
  }

  const { order } = delivery;
  const status = delivery.status;
  const finished = status === 'DELIVERED' || status === 'FAILED';
  const cancelled = status === 'FAILED' && order.status === 'CANCELLED';
  const name = customerName(order);
  const phone = customerPhone(order);
  const tel = telHref(phone);
  const wa = whatsappUrl(phone, `Bonjour, je suis votre livreur Fresh Fish pour la commande ${order.orderNumber}.`);
  const slot = scheduledLabel(order);
  const where = [order.address?.district, order.address?.landmark].filter(Boolean).join(' — ');
  const canReportIssue = ['PENDING', 'ASSIGNED', 'PICKED_UP', 'ON_ROUTE'].includes(status);
  const showContact = status !== 'DELIVERED';

  return (
    <div className="space-y-4">
      <div>
        <Link to="/livreur/livraisons" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink/60 hover:text-ink">
          <ArrowLeft size={15} /> Mes livraisons
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-xl font-bold text-ink">{order.orderNumber}</h1>
          <DeliveryStatusBadge delivery={delivery} />
        </div>
      </div>

      {!finished && (
        <div className="card px-3 py-4">
          <Stepper status={status} />
        </div>
      )}

      <section className="card p-4" aria-label="Client et adresse">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pine-900 font-display text-sm font-bold text-brand-500" aria-hidden="true">
            {initialsOf(name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display font-semibold text-ink">{name}</p>
            {status !== 'DELIVERED' && phone && <p className="text-sm text-ink/55">{phone}</p>}
          </div>
        </div>

        <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <p className="flex items-start gap-2 text-ink/80">
            <MapPin size={16} className="mt-0.5 shrink-0 text-brand-700" />
            <span>{where || 'Adresse à confirmer avec le client'}</span>
          </p>
          {order.address?.instructions && (
            <p className="flex items-start gap-2 text-ink/60">
              <StickyNote size={16} className="mt-0.5 shrink-0" />
              <span className="italic">« {order.address.instructions} »</span>
            </p>
          )}
          {slot && (
            <p className="flex items-center gap-2 font-medium text-ink/70">
              <Clock size={16} className="shrink-0" /> Livraison souhaitée : {slot}
            </p>
          )}
          {order.notes && (
            <p className="rounded-lg bg-mist px-3 py-2 text-ink/70">
              <span className="font-semibold text-ink/80">Note du client : </span>
              {order.notes}
            </p>
          )}
        </div>

        {showContact && (
          <div className="mt-4 space-y-2">
            <a href={mapUrl(order)} target="_blank" rel="noreferrer" className="btn-primary w-full">
              <Navigation size={17} /> Ouvrir dans la carte
            </a>
            {(tel || wa) && (
              <div className={`grid gap-2 ${tel && wa ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {tel && (
                  <a href={tel} className="btn-secondary">
                    <Phone size={16} /> Appeler le client
                  </a>
                )}
                {wa && (
                  <a href={wa} target="_blank" rel="noreferrer" className="btn-secondary">
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card space-y-3 p-4" aria-label="Action">
        {status === 'PENDING' || status === 'ASSIGNED' ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => driversApi.updateDeliveryStatus(orderId, 'PICKED_UP'), 'Livraison commencée : votre position est partagée avec le client')}
              className="btn-primary w-full"
            >
              <PackageCheck size={17} /> Commencer la livraison
            </button>
            <p className="text-center text-xs text-ink/50">Touchez ce bouton quand vous avez récupéré la commande.</p>
          </>
        ) : status === 'PICKED_UP' ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => driversApi.updateDeliveryStatus(orderId, 'ON_ROUTE'), 'Bonne route !')}
              className="btn-primary w-full"
            >
              <Navigation size={17} /> Je suis en route
            </button>
            <p className="text-center text-xs text-ink/50">Le client est prévenu que vous arrivez.</p>
          </>
        ) : status === 'ON_ROUTE' ? (
          <>
            <button type="button" onClick={() => navigate(`/livreur/livraisons/${orderId}/confirmer`)} className="btn-primary w-full">
              <CheckCircle2 size={17} /> Confirmer la livraison
            </button>
            <p className="text-center text-xs text-ink/50">À la remise, demandez au client son code à 4 chiffres.</p>
          </>
        ) : status === 'DELIVERED' ? (
          <div className="flex items-start gap-3 text-sm">
            <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-brand-600" />
            <div>
              <p className="font-display font-semibold text-brand-700">Livraison terminée</p>
              {delivery.deliveredAt && (
                <p className="mt-0.5 text-ink/60">
                  {dayLabel(dayKey(delivery.deliveredAt))} à {timeLabel(delivery.deliveredAt)}
                </p>
              )}
            </div>
          </div>
        ) : cancelled ? (
          <div className="flex items-start gap-3 text-sm">
            <AlertTriangle size={22} className="mt-0.5 shrink-0 text-red-500" />
            <div>
              <p className="font-display font-semibold text-red-700">Commande annulée</p>
              <p className="mt-1 text-ink/60">Cette commande a été annulée : il n'y a plus rien à livrer.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 text-sm text-amber-900">
            <AlertTriangle size={22} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-display font-semibold">Problème signalé</p>
              <p className="mt-1 text-amber-800/80">
                L'administration a été prévenue. Elle vous recontactera pour une nouvelle tentative, ou confiera la commande à un autre livreur.
              </p>
            </div>
          </div>
        )}
      </section>

      {!cancelled && <PaymentPanel delivery={delivery} />}

      <section className="card p-4" aria-label="Produits">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/40">Produits</h2>
        <ul className="space-y-1.5 text-sm text-ink/75">
          {order.items?.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>
                {item.name} × {Number(item.quantity).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
              </span>
              <span className="shrink-0">{formatFCFA(item.total)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          {order.deliveryFee > 0 && (
            <div className="flex justify-between text-ink/60">
              <dt>Livraison</dt>
              <dd>{formatFCFA(order.deliveryFee)}</dd>
            </div>
          )}
          {order.discount > 0 && (
            <div className="flex justify-between text-ink/60">
              <dt>Remise</dt>
              <dd>− {formatFCFA(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between font-display font-bold text-ink">
            <dt>Total</dt>
            <dd>{formatFCFA(order.total)}</dd>
          </div>
        </dl>
      </section>

      {canReportIssue && (
        <button
          type="button"
          onClick={() => setIssueOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-amber-300 bg-amber-50 px-5 py-3 font-display text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
        >
          <AlertTriangle size={17} /> Problème avec la livraison
        </button>
      )}

      <ReportIssueModal open={issueOpen} onClose={() => setIssueOpen(false)} onSubmit={reportIssue} />
    </div>
  );
}
