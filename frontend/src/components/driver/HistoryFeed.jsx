import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, History as HistoryIcon, Loader2 } from 'lucide-react';
import { driversApi } from '../../api/logistics';
import { toast } from '../../store/toastStore';
import EmptyState from '../EmptyState';
import Loader from '../Loader';
import { DeliveryStatusBadge } from './DeliveryCard';
import { customerName, endedAt, dayKey, dayLabel, timeLabel } from '../../utils/delivery';
import { formatFCFA } from '../../utils/format';

function Row({ delivery }) {
  const { order } = delivery;
  return (
    <Link to={`/livreur/livraisons/${delivery.orderId}`} className="card block p-3.5 transition hover:border-brand-500/40" data-history={order.orderNumber}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-ink">{order.orderNumber}</p>
          <p className="truncate text-xs text-ink/60">{customerName(order)}</p>
        </div>
        <DeliveryStatusBadge delivery={delivery} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-ink/50">
        <span className="flex min-w-0 items-center gap-1">
          <MapPin size={12} className="shrink-0" />
          <span className="truncate">{order.address?.district || '—'}</span>
        </span>
        <span className="shrink-0">
          {timeLabel(endedAt(delivery))} · <span className="font-semibold text-ink/70">{formatFCFA(order.total)}</span>
        </span>
      </div>
    </Link>
  );
}

/**
 * Livraisons terminées (livrées, sans suite ou annulées), chargées par pages.
 * `grouped` : regroupées par jour (heure de Douala) avec le total des espèces encaissées.
 */
export default function HistoryFeed({ pageSize = 20, grouped = true }) {
  const [items, setItems] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);

  const fetchPage = useCallback((p) => driversApi.myDeliveries({ scope: 'history', limit: pageSize, page: p }), [pageSize]);

  useEffect(() => {
    let ignore = false;
    fetchPage(1)
      .then((rows) => {
        if (ignore) return;
        setItems(rows);
        setHasMore(rows.length === pageSize);
      })
      .catch(() => {
        if (ignore) return;
        setItems([]);
        setFailed(true);
      });
    return () => {
      ignore = true;
    };
  }, [fetchPage, pageSize]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const rows = await fetchPage(page + 1);
      setItems((current) => [...current, ...rows.filter((r) => !current.some((c) => c.id === r.id))]);
      setPage(page + 1);
      setHasMore(rows.length === pageSize);
    } catch (err) {
      toast.error(err.message || 'Chargement impossible');
    } finally {
      setLoadingMore(false);
    }
  };

  const days = useMemo(() => {
    if (!items) return [];
    const sorted = [...items].sort((a, b) => new Date(endedAt(b)) - new Date(endedAt(a)));
    if (!grouped) return [{ key: 'all', rows: sorted }];
    const map = new Map();
    sorted.forEach((d) => {
      const key = dayKey(endedAt(d));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    });
    return [...map.entries()].map(([key, rows]) => ({ key, rows }));
  }, [items, grouped]);

  if (items === null) return <Loader />;
  if (failed) return <EmptyState icon={HistoryIcon} title="Historique indisponible" description="Vérifiez votre connexion puis réessayez." action={<button type="button" className="btn-secondary mt-2" onClick={() => window.location.reload()}>Réessayer</button>} />;
  if (items.length === 0) return <EmptyState icon={HistoryIcon} title="Aucune livraison terminée" description="Vos livraisons terminées apparaîtront ici." />;

  return (
    <div className="space-y-5">
      {days.map(({ key, rows }) => {
        const delivered = rows.filter((d) => d.status === 'DELIVERED');
        const cash = delivered.reduce((sum, d) => sum + (d.cashReceived || 0), 0);
        return (
          <section key={key} aria-label={grouped ? dayLabel(key) : 'Livraisons terminées'}>
            {grouped && (
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2 className="font-display text-sm font-semibold text-ink">{dayLabel(key)}</h2>
                <p className="text-xs text-ink/50">
                  {delivered.length} livrée{delivered.length > 1 ? 's' : ''}
                  {cash > 0 && ` · ${formatFCFA(cash)} en espèces`}
                </p>
              </div>
            )}
            <div className="space-y-2">
              {rows.map((d) => (
                <Row key={d.id} delivery={d} />
              ))}
            </div>
          </section>
        );
      })}
      {hasMore && (
        <button type="button" onClick={loadMore} disabled={loadingMore} className="btn-secondary w-full">
          {loadingMore && <Loader2 size={16} className="animate-spin" />} Voir plus
        </button>
      )}
    </div>
  );
}
