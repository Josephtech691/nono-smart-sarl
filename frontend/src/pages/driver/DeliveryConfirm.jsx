import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Banknote, Smartphone, AlertTriangle, KeyRound, Loader2, PackageSearch } from 'lucide-react';
import { driversApi } from '../../api/logistics';
import { useDriverStore } from '../../store/driverStore';
import CodeInput from '../../components/CodeInput';
import EmptyState from '../../components/EmptyState';
import Loader from '../../components/Loader';
import usePageMeta from '../../utils/usePageMeta';
import { cashDue, customerName, paymentSummary, pickNextDelivery } from '../../utils/delivery';
import { formatFCFA } from '../../utils/format';

const CODE_LENGTH = 4;

function Success({ delivery, orderId }) {
  const active = useDriverStore((s) => s.active);
  const { order } = delivery;
  const isCash = order.payment?.method === 'CASH';
  const received = delivery.cashReceived ?? 0;
  const missing = isCash ? Math.max(0, order.total - received) : 0;
  const next = pickNextDelivery((active || []).filter((d) => d.orderId !== orderId));

  return (
    <div className="space-y-5 pt-4 text-center" data-testid="confirm-success">
      <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-500/15 text-brand-600">
        <CheckCircle2 size={44} strokeWidth={1.75} />
      </span>
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Livraison confirmée</h1>
        <p className="mt-1 text-sm text-ink/60">
          {order.orderNumber} · {customerName(order)}
        </p>
      </div>

      {isCash && (
        <div className="card mx-auto max-w-xs p-4">
          <p className="text-xs text-ink/55">Espèces encaissées</p>
          <p className="font-display text-2xl font-bold text-ink">{formatFCFA(received)}</p>
        </div>
      )}
      {missing > 0 && (
        <p role="status" className="mx-auto flex max-w-xs items-start gap-2 rounded-xl2 border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <span>Il manquait {formatFCFA(missing)} : le paiement reste en attente et l'administration a été prévenue.</span>
        </p>
      )}

      <div className="mx-auto max-w-xs space-y-2 pt-2">
        {next ? (
          <>
            <Link to={`/livreur/livraisons/${next.orderId}`} className="btn-primary w-full">
              Livraison suivante · {next.order.orderNumber}
            </Link>
            <Link to="/livreur" className="btn-secondary w-full">
              Retour à l'accueil
            </Link>
          </>
        ) : (
          <Link to="/livreur" className="btn-primary w-full">
            Retour à l'accueil
          </Link>
        )}
      </div>
    </div>
  );
}

export default function DriverDeliveryConfirm() {
  usePageMeta('Confirmer la livraison');
  const { orderId } = useParams();
  const refreshStore = useDriverStore((s) => s.refresh);

  const [delivery, setDelivery] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [code, setCode] = useState('');
  const [received, setReceived] = useState('');
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0); // fait repartir la saisie du code (focus sur la 1re case) après une erreur
  const [result, setResult] = useState(null);
  const submitting = useRef(false);
  const prefilled = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await driversApi.getDelivery(orderId);
      setDelivery(data);
      if (!prefilled.current) {
        prefilled.current = true;
        setReceived(String(cashDue(data) || ''));
      }
      return data;
    } catch (err) {
      setLoadError(err.status === 404 ? 'not-found' : err.message || 'Chargement impossible');
      return null;
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  if (result) return <Success delivery={result} orderId={orderId} />;

  if (!delivery) {
    if (loadError) {
      return (
        <EmptyState
          icon={PackageSearch}
          title={loadError === 'not-found' ? 'Livraison introuvable' : 'Chargement impossible'}
          description={loadError === 'not-found' ? "Elle n'existe pas ou n'est plus assignée à votre compte." : loadError}
          action={<Link to="/livreur/livraisons" className="btn-primary mt-2">Mes livraisons</Link>}
        />
      );
    }
    return <Loader />;
  }

  // On ne confirme que depuis « récupérée » ou « en route » (même règle que le serveur) ;
  // sinon (déjà livrée, annulée, problème signalé) on renvoie vers la fiche de la livraison.
  if (!['PICKED_UP', 'ON_ROUTE'].includes(delivery.status)) {
    return <Navigate to={`/livreur/livraisons/${orderId}`} replace />;
  }

  const { order } = delivery;
  const pay = paymentSummary(order, delivery);
  const isCash = pay.kind === 'cash';
  const due = cashDue(delivery);
  const receivedNumber = received === '' ? null : Number(received);
  const difference = isCash && receivedNumber !== null ? receivedNumber - due : 0;
  const ready = code.length === CODE_LENGTH && (!isCash || receivedNumber !== null) && !locked;

  const submit = async (e) => {
    e.preventDefault();
    if (submitting.current || locked) return;
    if (code.length !== CODE_LENGTH) return setError(`Saisissez les ${CODE_LENGTH} chiffres du code`);
    if (isCash && receivedNumber === null) return setError('Indiquez le montant reçu');

    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const done = await driversApi.confirmDelivery(orderId, { code, cashReceived: isCash ? receivedNumber : undefined });
      setResult(done);
      refreshStore();
    } catch (err) {
      if (err.status === 429) {
        setLocked(true);
        setError(err.message);
      } else if (err.status === 400 && /code de confirmation/i.test(err.message || '')) {
        setError('Code incorrect. Demandez-le à nouveau au client : il le voit dans le suivi de sa commande.');
        setCode('');
        setAttempt((n) => n + 1);
      } else {
        setError(err.message || 'Confirmation impossible');
        // La réponse a pu se perdre alors que la livraison est bien confirmée : on vérifie.
        // (Appel direct, sans passer par load() : mettre d'abord la fiche à jour renverrait le
        // livreur vers la page de la livraison avant que l'écran « confirmée » ne s'affiche.)
        try {
          const fresh = await driversApi.getDelivery(orderId);
          if (fresh.status === 'DELIVERED') {
            setResult(fresh);
            refreshStore();
          } else {
            setDelivery(fresh); // annulée, signalée… : la garde ci-dessous renvoie vers la fiche
          }
        } catch {
          // Hors ligne : le message d'erreur reste affiché et le livreur peut réessayer.
        }
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <Link to={`/livreur/livraisons/${orderId}`} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink/60 hover:text-ink">
          <ArrowLeft size={15} /> Retour à la livraison
        </Link>
        <h1 className="font-display text-xl font-bold text-ink">Confirmer la livraison</h1>
        <p className="text-sm text-ink/55">
          {order.orderNumber} · {customerName(order)}
        </p>
      </div>

      <section className="card p-5" aria-labelledby="code-title">
        <h2 id="code-title" className="flex items-center gap-2 font-display text-base font-semibold text-ink">
          <KeyRound size={17} className="text-brand-700" /> Code du client
        </h2>
        <p className="mb-4 mt-1 text-sm text-ink/55">Demandez au client son code à {CODE_LENGTH} chiffres : il le voit dans le suivi de sa commande.</p>
        <CodeInput key={attempt} value={code} onChange={(v) => { setCode(v); if (error && !locked) setError(''); }} length={CODE_LENGTH} invalid={!!error && !locked} disabled={busy || locked} autoFocus />
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700">
            {error}
          </p>
        )}
      </section>

      <section className="card p-5" aria-labelledby="pay-title">
        <h2 id="pay-title" className="flex items-center gap-2 font-display text-base font-semibold text-ink">
          {isCash ? <Banknote size={17} className="text-brand-700" /> : <Smartphone size={17} className="text-brand-700" />}
          {isCash ? 'Encaissement' : 'Paiement'}
        </h2>

        {isCash ? (
          <div className="mt-3 space-y-3">
            <div className="flex items-baseline justify-between rounded-xl2 bg-amber-50 px-4 py-3">
              <span className="text-sm text-amber-900">Montant à recevoir</span>
              <span className="font-display text-xl font-bold text-ink" data-testid="amount-due">{formatFCFA(due)}</span>
            </div>
            <div>
              <label htmlFor="cash-received" className="label">Montant reçu du client (FCFA)</label>
              <input
                id="cash-received"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                className="input text-right font-display text-lg font-semibold"
                value={received}
                disabled={busy}
                onChange={(e) => setReceived(e.target.value.replace(/\D/g, '').slice(0, 9))}
              />
            </div>
            {difference < 0 && (
              <p role="status" data-testid="cash-short" className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <span>Il manque {formatFCFA(-difference)}. La livraison sera confirmée, mais le paiement restera en attente et l'administration sera prévenue.</span>
              </p>
            )}
            {difference > 0 && (
              <p role="status" data-testid="cash-change" className="rounded-lg bg-mist px-3 py-2 text-sm text-ink/70">
                Monnaie à rendre au client : <span className="font-semibold text-ink">{formatFCFA(difference)}</span>
              </p>
            )}
          </div>
        ) : pay.kind === 'paid' ? (
          <p className="mt-3 rounded-xl2 bg-brand-500/10 px-4 py-3 text-sm text-brand-700">
            {pay.label} — rien à encaisser, la commande est déjà payée.
          </p>
        ) : (
          <p className="mt-3 flex items-start gap-2 rounded-xl2 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
            <span>{pay.label}. Vérifiez avec l'administration avant de confirmer : rien n'est à encaisser en espèces.</span>
          </p>
        )}
      </section>

      <button type="submit" disabled={!ready || busy} className="btn-primary w-full">
        {busy ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />} {busy ? 'Confirmation…' : 'Confirmer la livraison'}
      </button>
    </form>
  );
}
