import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, PackageCheck, Phone, RotateCcw } from 'lucide-react';
import { driversApi } from '../../api/logistics';
import EmptyState from '../../components/EmptyState';
import { RowSkeleton } from '../../components/Skeleton';
import { DeliveryStatusBadge } from '../../components/driver/DeliveryCard';
import DateRange from '../../components/admin/DateRange';
import Pagination from '../../components/admin/Pagination';
import SearchBox from '../../components/admin/SearchBox';
import TabBar from '../../components/admin/TabBar';
import useAdminList from '../../hooks/useAdminList';
import useUrlFilters from '../../hooks/useUrlFilters';
import { cashDue } from '../../utils/delivery';
import { formatFCFA, formatPhone, formatShortDate, PAYMENT_METHOD_SHORT_LABELS } from '../../utils/format';
import { canAssignDriver, orderCustomerName, orderPlace } from '../../utils/orders';
import usePageMeta from '../../utils/usePageMeta';

const PAGE_SIZE = 20;
const REFRESH_MS = 60000;
const DEFAULTS = { groupe: '', livreur: '', q: '', du: '', au: '', page: '1' };

const TABS = [
  { value: '', label: 'Toutes', counter: 'all' },
  { value: 'unassigned', label: 'À assigner', counter: 'unassigned' },
  { value: 'assigned', label: 'Assignées', counter: 'assigned' },
  { value: 'active', label: 'En cours', counter: 'active' },
  { value: 'delivered', label: 'Livrées', counter: 'delivered' },
  { value: 'problem', label: 'Problèmes', counter: 'problem', alert: true },
];

const knownTab = (value) => (TABS.some((t) => t.value === value) ? value : '');

function buildQuery(f) {
  const params = {};
  const group = knownTab(f.groupe);
  if (group) params.group = group;
  if (f.livreur) params.driverId = f.livreur;
  if (f.q) params.search = f.q;
  if (f.du) params.from = f.du;
  if (f.au) params.to = f.au;
  return params;
}

const READY_TO_ASSIGN = ['CONFIRMED', 'PREPARING', 'READY'];

// « À assigner » : la commande est confirmée mais n'a pas encore de livreur (c'est l'onglet du même nom).
// Tant qu'elle n'est pas confirmée, il n'y a rien à assigner : la livraison reste simplement « En attente ».
function DeliveryBadge({ delivery }) {
  if (!delivery.driverId && delivery.status === 'PENDING' && READY_TO_ASSIGN.includes(delivery.order?.status)) {
    return <span className="badge bg-amber-100 text-amber-800">À assigner</span>;
  }
  return <DeliveryStatusBadge delivery={delivery} />;
}

function DriverCell({ delivery }) {
  const user = delivery.driver?.user;
  if (!user) {
    // Le lien « Assigner » n'est proposé que si la fiche commande permet de choisir un livreur.
    if (!canAssignDriver({ ...delivery.order, delivery })) return <p className="text-sm text-ink/50">Non assignée</p>;
    return (
      <Link to={`/admin/commandes/${delivery.orderId}`} className="text-sm font-medium text-amber-700 hover:underline">
        Non assignée · Assigner
      </Link>
    );
  }
  return (
    <div>
      <p className="font-medium text-ink">{`${user.firstName} ${user.lastName}`.trim()}</p>
      {user.phone && (
        <a href={`tel:${user.phone}`} className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
          <Phone size={11} aria-hidden="true" /> {formatPhone(user.phone)}
        </a>
      )}
    </div>
  );
}

// Espèces : « à encaisser » tant que le livreur n'a rien perçu, « encaissé » ensuite ; Mobile Money : le moyen de paiement.
function CashCell({ delivery }) {
  const payment = delivery.order?.payment;
  const method = PAYMENT_METHOD_SHORT_LABELS[payment?.method] || '—';
  const due = cashDue(delivery);
  return (
    <div className="text-sm">
      <p className="text-ink/80">{method}</p>
      {due > 0 && <p className="text-xs font-semibold text-amber-700">À encaisser : {formatFCFA(due)}</p>}
      {payment?.method === 'CASH' && delivery.cashReceived != null && <p className="text-xs text-brand-700">Encaissé : {formatFCFA(delivery.cashReceived)}</p>}
    </div>
  );
}

const lastUpdate = (d) => d.deliveredAt || d.pickedUpAt || d.assignedAt || d.order?.createdAt;

export default function AdminDeliveries() {
  usePageMeta('Livraisons');
  const [filters, setFilters] = useUrlFilters(DEFAULTS);
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    driversApi.list().then(setDrivers).catch(() => setDrivers([]));
  }, []);

  const group = knownTab(filters.groupe);
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const query = buildQuery(filters);
  const { data, loading, error, reload } = useAdminList((params) => driversApi.deliveries(params), { ...query, page, limit: PAGE_SIZE }, { refreshMs: REFRESH_MS });

  const items = data?.items || [];
  const total = data?.total || 0;
  const counts = data?.counts || {};
  const hasFilters = Boolean(filters.livreur || filters.q || filters.du || filters.au);

  useEffect(() => {
    if (data && total > 0 && items.length === 0 && page > 1) setFilters({ page: Math.ceil(total / PAGE_SIZE) });
  }, [data, total, items.length, page, setFilters]);

  const change = (patch) => setFilters({ ...patch, page: 1 });
  const clearFilters = () => change({ livreur: '', q: '', du: '', au: '' });
  const tabs = TABS.map((t) => ({ value: t.value, label: t.label, alert: t.alert, count: data ? counts[t.counter] : undefined }));

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-ink">Livraisons</h1>
        <p className="text-sm text-ink/55">Qui livre quoi, où en est chaque livraison, et ce que les livreurs doivent encaisser.</p>
      </div>

      <div className="mt-5">
        <TabBar tabs={tabs} value={group} onChange={(value) => change({ groupe: value })} label="Livraisons par état" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <SearchBox value={filters.q} onSearch={(q) => change({ q })} placeholder="Rechercher : n° de commande, client, téléphone, quartier…" label="Rechercher une livraison" />
        <DateRange from={filters.du} to={filters.au} onChange={change} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select aria-label="Livreur" className="input !w-auto !py-2 text-sm" value={filters.livreur} onChange={(e) => change({ livreur: e.target.value })}>
          <option value="">Tous les livreurs</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.user.firstName} {d.user.lastName}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
            <RotateCcw size={14} aria-hidden="true" /> Effacer les filtres
          </button>
        )}
      </div>

      <div className={`mt-5 transition-opacity ${loading && data ? 'opacity-60' : ''}`} aria-busy={loading}>
        {error ? (
          <EmptyState
            icon={PackageCheck}
            title="Chargement impossible"
            description={error}
            action={
              <button type="button" onClick={() => reload()} className="btn-primary mt-2">
                Réessayer
              </button>
            }
          />
        ) : !data ? (
          <RowSkeleton count={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title={hasFilters || group ? 'Aucune livraison trouvée' : 'Aucune livraison pour le moment'}
            description={hasFilters ? 'Aucune livraison ne correspond à ces filtres.' : group ? 'Aucune livraison dans cet onglet.' : 'Les livraisons apparaissent ici dès qu’une commande est passée.'}
            action={
              hasFilters ? (
                <button type="button" onClick={clearFilters} className="btn-secondary mt-2 !px-4 !py-2 text-sm">
                  Effacer les filtres
                </button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="card hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-left text-sm" data-testid="deliveries-table">
                <thead className="border-b border-line bg-mist/60 text-xs uppercase tracking-wide text-ink/50">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Commande</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Client</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Livreur</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Livraison</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Paiement</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Mise à jour</th>
                    <th scope="col" className="w-10 px-2 py-3"><span className="sr-only">Voir</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((d) => (
                    <tr key={d.id} className="transition hover:bg-mist/40" data-order={d.order.orderNumber}>
                      <td className="px-4 py-3">
                        <Link to={`/admin/commandes/${d.orderId}`} className="font-semibold text-ink hover:text-brand-700 hover:underline">
                          {d.order.orderNumber}
                        </Link>
                        <p className="text-xs text-ink/50">{formatFCFA(d.order.total)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{orderCustomerName(d.order)}</p>
                        {orderPlace(d.order) && <p className="text-xs text-ink/50">{orderPlace(d.order)}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <DriverCell delivery={d} />
                      </td>
                      <td className="px-4 py-3">
                        <DeliveryBadge delivery={d} />
                      </td>
                      <td className="px-4 py-3">
                        <CashCell delivery={d} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink/60">{formatShortDate(lastUpdate(d))}</td>
                      <td className="px-2 py-3 text-right">
                        <Link to={`/admin/commandes/${d.orderId}`} aria-label={`Voir la commande ${d.order.orderNumber}`} className="inline-flex rounded-full p-1.5 text-ink/40 hover:bg-mist hover:text-ink">
                          <ChevronRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 md:hidden" data-testid="deliveries-cards">
              {items.map((d) => (
                <li key={d.id} className="card p-4" data-order={d.order.orderNumber}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/admin/commandes/${d.orderId}`} className="font-display font-semibold text-ink hover:text-brand-700">
                        {d.order.orderNumber}
                      </Link>
                      <p className="truncate text-sm text-ink/70">{orderCustomerName(d.order)}</p>
                      {orderPlace(d.order) && <p className="truncate text-xs text-ink/50">{orderPlace(d.order)}</p>}
                    </div>
                    <DeliveryBadge delivery={d} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
                    <div>
                      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink/40">Livreur</p>
                      <DriverCell delivery={d} />
                    </div>
                    <div className="text-right">
                      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink/40">Paiement</p>
                      <CashCell delivery={d} />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-ink/45">Mis à jour : {formatShortDate(lastUpdate(d))}</p>
                </li>
              ))}
            </ul>

            <div className="mt-5">
              <Pagination page={page} limit={PAGE_SIZE} total={total} onChange={(p) => { setFilters({ page: p }); window.scrollTo({ top: 0 }); }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
