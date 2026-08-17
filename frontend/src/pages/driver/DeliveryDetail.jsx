import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Phone, Navigation, PackageCheck, CheckCircle2, Satellite } from 'lucide-react';
import { driversApi } from '../../api/logistics';
import Loader from '../../components/Loader';
import { toast } from '../../store/toastStore';
import { formatFCFA, PAYMENT_METHOD_LABELS } from '../../utils/format';

// Diffuse la position GPS toutes les 20s pendant une livraison active, pour
// alimenter la carte de suivi cote client (section 75 "suivi livreur").
function useLocationBroadcast(active) {
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);
  const lastPositionRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!active || !navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        lastPositionRef.current = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setSharing(true);
      },
      () => setSharing(false),
      { enableHighAccuracy: true, maximumAge: 15000 }
    );

    const send = () => {
      if (lastPositionRef.current) {
        driversApi.updateMyLocation(lastPositionRef.current.latitude, lastPositionRef.current.longitude).catch(() => {});
      }
    };
    send();
    intervalRef.current = setInterval(send, 20000);

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      clearInterval(intervalRef.current);
    };
  }, [active]);

  return sharing;
}

export default function DriverDeliveryDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState(null);
  const [code, setCode] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => driversApi.getDelivery(orderId).then(setDelivery);

  useEffect(() => { load(); }, [orderId]);

  const isLocationActive = delivery && ['PICKED_UP', 'ON_ROUTE'].includes(delivery.status);
  const sharingLocation = useLocationBroadcast(isLocationActive);

  if (!delivery) return <Loader />;

  const { order } = delivery;
  const isCash = order.payment?.method === 'CASH';
  const mapUrl = order.address?.latitude
    ? `https://www.google.com/maps/search/?api=1&query=${order.address.latitude},${order.address.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${order.address?.district}, Yaoundé, Cameroun`)}`;

  const startDelivery = async () => {
    setBusy(true);
    try {
      await driversApi.updateDeliveryStatus(orderId, 'PICKED_UP');
      toast.success('Livraison commencée — position partagée avec le client');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const markOnRoute = async () => {
    setBusy(true);
    try {
      await driversApi.updateDeliveryStatus(orderId, 'ON_ROUTE');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setError('');
    if (code.length !== 4) return setError('Le code a 4 chiffres');
    if (isCash && !cashReceived) return setError('Indiquez le montant reçu');
    setBusy(true);
    try {
      await driversApi.confirmDelivery(orderId, { code, cashReceived: isCash ? Number(cashReceived) : undefined });
      toast.success('Livraison confirmée');
      navigate('/livreur');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link to="/livreur" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink/60">
        <ArrowLeft size={15} /> Mes livraisons
      </Link>

      {isLocationActive && (
        <div className={`mb-3 flex items-center gap-2 rounded-xl2 border px-3 py-2 text-xs font-medium ${sharingLocation ? 'border-brand-200 bg-brand-500/10 text-brand-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          <Satellite size={14} /> {sharingLocation ? 'Position partagée en direct avec le client' : "En attente du signal GPS de l'appareil..."}
        </div>
      )}

      <div className="card p-4">
        <p className="font-display text-lg font-bold text-ink">{order.orderNumber}</p>
        <p className="mt-1 text-sm text-ink/60">{order.address?.district}{order.address?.landmark ? ` — ${order.address.landmark}` : ''}</p>
        {order.address?.instructions && <p className="mt-1 text-xs italic text-ink/50">"{order.address.instructions}"</p>}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href={`tel:${order.address?.phone}`} className="btn-secondary !py-2.5 text-sm"><Phone size={16} /> Appeler</a>
          <a href={mapUrl} target="_blank" rel="noreferrer" className="btn-secondary !py-2.5 text-sm"><Navigation size={16} /> Itinéraire</a>
        </div>
      </div>

      <div className="card mt-4 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/40">Produits</p>
        <ul className="space-y-1 text-sm text-ink/70">
          {order.items?.map((it) => (
            <li key={it.id} className="flex justify-between"><span>{it.name} × {it.quantity}</span><span>{formatFCFA(it.total)}</span></li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-line pt-2 font-display font-bold text-ink">
          <span>Total</span><span>{formatFCFA(order.total)}</span>
        </div>
        <p className="mt-1 text-xs text-ink/50">{PAYMENT_METHOD_LABELS[order.payment?.method]}</p>
      </div>

      <div className="card mt-4 p-4">
        {delivery.status === 'ASSIGNED' || delivery.status === 'PENDING' ? (
          <button onClick={startDelivery} disabled={busy} className="btn-primary w-full"><PackageCheck size={17} /> Commencer la livraison</button>
        ) : delivery.status === 'PICKED_UP' ? (
          <button onClick={markOnRoute} disabled={busy} className="btn-primary w-full"><Navigation size={17} /> Je suis en route</button>
        ) : delivery.status === 'ON_ROUTE' ? (
          <div className="space-y-3">
            <div>
              <label className="label">Code de confirmation du client</label>
              <input className="input text-center font-display text-lg tracking-widest" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="0000" />
            </div>
            {isCash && (
              <div>
                <label className="label">Montant reçu en espèces (attendu : {formatFCFA(delivery.cashExpected)})</label>
                <input type="number" className="input" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} />
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button onClick={confirm} disabled={busy} className="btn-primary w-full"><CheckCircle2 size={17} /> Confirmer la livraison</button>
          </div>
        ) : (
          <p className="text-center text-sm text-brand-700">Livraison terminée. Merci !</p>
        )}
      </div>
    </div>
  );
}
