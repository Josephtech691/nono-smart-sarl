import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Package } from 'lucide-react';
import { driversApi } from '../../api/logistics';
import { useAuthStore } from '../../store/authStore';
import Loader from '../../components/Loader';
import EmptyState from '../../components/EmptyState';
import { formatFCFA, PAYMENT_METHOD_LABELS } from '../../utils/format';

const STATUS_LABELS = { PENDING: 'En attente', ASSIGNED: 'Assignée', PICKED_UP: 'Récupérée', ON_ROUTE: 'En route', DELIVERED: 'Livrée', FAILED: 'Échouée' };

export default function DriverDeliveries() {
  const { user } = useAuthStore();
  const [deliveries, setDeliveries] = useState(null);
  const [myStatus, setMyStatus] = useState(user?.driverProfile?.status || 'OFFLINE');

  useEffect(() => {
    driversApi.myDeliveries().then(setDeliveries).catch(() => setDeliveries([]));
  }, []);

  const changeMyStatus = async (status) => {
    setMyStatus(status);
    await driversApi.updateMyStatus(status);
  };

  const active = deliveries?.filter((d) => !['DELIVERED', 'FAILED'].includes(d.status)) || [];
  const past = deliveries?.filter((d) => ['DELIVERED', 'FAILED'].includes(d.status)) || [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">Mes livraisons</h1>
        <select value={myStatus} onChange={(e) => changeMyStatus(e.target.value)} className="input !w-auto !py-1.5 text-xs font-semibold">
          <option value="AVAILABLE">Disponible</option>
          <option value="BUSY">Occupé</option>
          <option value="OFFLINE">Hors ligne</option>
        </select>
      </div>

      {deliveries === null ? (
        <Loader />
      ) : active.length === 0 && past.length === 0 ? (
        <EmptyState icon={Package} title="Aucune livraison" description="Vos livraisons assignées apparaîtront ici." />
      ) : (
        <div className="space-y-5">
          {active.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">En cours</p>
              {active.map((d) => (
                <Link key={d.id} to={`/livreur/livraisons/${d.orderId}`} className="card block p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-display font-semibold text-ink">{d.order.orderNumber}</p>
                    <span className="badge bg-brand-500/15 text-brand-700">{STATUS_LABELS[d.status]}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/60"><MapPin size={14} /> {d.order.address?.district}</p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-ink/50">{PAYMENT_METHOD_LABELS[d.order.payment?.method]}</span>
                    <span className="font-semibold text-ink">{formatFCFA(d.order.total)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Terminées</p>
              {past.map((d) => (
                <Link key={d.id} to={`/livreur/livraisons/${d.orderId}`} className="card block p-4 opacity-60">
                  <div className="flex items-center justify-between">
                    <p className="font-display font-semibold text-ink">{d.order.orderNumber}</p>
                    <span className="badge bg-mist text-ink/50">{STATUS_LABELS[d.status]}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
