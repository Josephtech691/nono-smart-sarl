import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PackageSearch, RotateCcw, Loader2, Star } from 'lucide-react';
import { ordersApi } from '../../api/orders';
import AccountBack from '../../components/AccountBack';
import StatusBadge from '../../components/StatusBadge';
import PaymentBadge from '../../components/PaymentBadge';
import { RowSkeleton } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import { toast } from '../../store/toastStore';
import usePageMeta from '../../utils/usePageMeta';
import { reorderItems } from '../../utils/reorder';
import { formatFCFA, formatDate } from '../../utils/format';

const isFinal = (o) => o.status === 'DELIVERED' || o.status === 'CANCELLED';

// La clé sert de valeur au paramètre d'adresse ?filtre= (liens du tableau de bord).
const TABS = [
  { key: 'toutes', label: 'Toutes', match: () => true },
  { key: 'en-cours', label: 'En cours', match: (o) => !isFinal(o) },
  { key: 'livrees', label: 'Livrées', match: (o) => o.status === 'DELIVERED' },
  { key: 'annulees', label: 'Annulées', match: (o) => o.status === 'CANCELLED' },
];

export default function Orders() {
  usePageMeta('Mes commandes');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [orders, setOrders] = useState(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let ignore = false;
    ordersApi
      .list({ limit: 100 })
      .then((r) => {
        if (ignore) return;
        setOrders(r.items || []);
        setTotal(r.total ?? (r.items || []).length);
      })
      .catch(() => {
        if (ignore) return;
        setOrders([]);
        setFailed(true);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const requested = params.get('filtre');
  const activeTab = TABS.find((t) => t.key === requested) || TABS[0];

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, (orders || []).filter(t.match).length])), [orders]);
  const visible = useMemo(() => (orders || []).filter(activeTab.match), [orders, activeTab]);

  const selectTab = (key) => setParams(key === 'toutes' ? {} : { filtre: key }, { replace: true });

  // « Recommander une ancienne commande » : les produits sont revérifiés (stock, prix,
  // minimum de commande) avant d'être remis dans le panier.
  const reorder = async (order) => {
    if (busyId) return;
    setBusyId(order.id);
    try {
      const { added, skipped } = await reorderItems(order);
      if (!added.length) {
        toast.error('Ces produits ne sont plus disponibles pour le moment.');
        return;
      }
      const parts = [added.length === 1 ? '1 produit ajouté au panier' : `${added.length} produits ajoutés au panier`];
      const reduced = added.filter((a) => a.reduced).map((a) => a.name);
      if (skipped.length) parts.push(`indisponible : ${skipped.join(', ')}`);
      if (reduced.length) parts.push(`quantité limitée au stock : ${reduced.join(', ')}`);
      (parts.length > 1 ? toast.info : toast.success)(parts.join(' · '));
      navigate('/panier');
    } catch (err) {
      toast.error(err?.message || 'Impossible de recommander cette commande');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Mes commandes</h1>
      <AccountBack />

      {orders === null ? (
        <RowSkeleton count={4} />
      ) : failed ? (
        <EmptyState
          icon={PackageSearch}
          title="Impossible de charger vos commandes"
          description="Vérifiez votre connexion puis réessayez."
          action={<button type="button" onClick={() => window.location.reload()} className="btn-secondary mt-2">Réessayer</button>}
        />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Aucune commande pour le moment"
          description="Vos commandes apparaîtront ici."
          action={<Link to="/produits" className="btn-primary mt-2">Voir les produits</Link>}
        />
      ) : (
        <>
          <div role="tablist" aria-label="Filtrer mes commandes" className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {TABS.map((t) => {
              const selected = t.key === activeTab.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => selectTab(t.key)}
                  className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
                    selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink/70 hover:border-brand-500/50'
                  }`}
                >
                  {t.label}
                  <span className={`ml-1.5 text-xs ${selected ? 'text-white/80' : 'text-ink/40'}`}>{counts[t.key]}</span>
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="Aucune commande dans cette catégorie"
              action={<button type="button" onClick={() => selectTab('toutes')} className="btn-secondary mt-2">Voir toutes mes commandes</button>}
            />
          ) : (
            <div className="space-y-3" role="tabpanel">
              {visible.map((o) => {
                const items = o.items || [];
                const names = items.slice(0, 2).map((i) => i.name).join(', ') + (items.length > 2 ? '…' : '');
                const needsReview = o.status === 'DELIVERED' && !o.review;
                return (
                  <article key={o.id} className="card p-4" data-order={o.orderNumber}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/compte/commandes/${o.id}`} className="font-display font-semibold text-ink hover:text-brand-700">
                            {o.orderNumber}
                          </Link>
                          <StatusBadge status={o.status} />
                          {o.status !== 'CANCELLED' && o.payment && <PaymentBadge status={o.payment.status} method={o.payment.method} />}
                        </div>
                        <p className="mt-1 text-xs text-ink/50">
                          {formatDate(o.createdAt)} · {items.length} article{items.length > 1 ? 's' : ''}
                        </p>
                        {names && <p className="mt-0.5 truncate text-xs text-ink/50">{names}</p>}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <p className="mr-1 font-display font-bold text-ink">{formatFCFA(o.total)}</p>
                        {needsReview && (
                          <Link to={`/compte/commandes/${o.id}`} className="btn-secondary !px-3 !py-2 text-xs">
                            <Star size={14} /> Noter
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => reorder(o)}
                          disabled={busyId !== null}
                          className="btn-secondary !px-3 !py-2 text-xs"
                          aria-label={`Recommander la commande ${o.orderNumber}`}
                        >
                          {busyId === o.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Recommander
                        </button>
                        <Link to={`/compte/commandes/${o.id}`} className="btn-primary !px-3 !py-2 text-xs">Détails</Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {total > orders.length && (
            <p className="mt-4 text-center text-xs text-ink/45">
              Affichage des {orders.length} commandes les plus récentes sur {total}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
