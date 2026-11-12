import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ClipboardList, Download, RotateCcw } from 'lucide-react';
import { downloadOrdersCsv, ordersApi } from '../../api/orders';
import EmptyState from '../../components/EmptyState';
import PaymentBadge from '../../components/PaymentBadge';
import StatusBadge from '../../components/StatusBadge';
import { RowSkeleton } from '../../components/Skeleton';
import DateRange from '../../components/admin/DateRange';
import Pagination from '../../components/admin/Pagination';
import SearchBox from '../../components/admin/SearchBox';
import TabBar from '../../components/admin/TabBar';
import useAdminList from '../../hooks/useAdminList';
import useUrlFilters from '../../hooks/useUrlFilters';
import { toast } from '../../store/toastStore';
import { formatFCFA, formatShortDate, PAYMENT_METHOD_SHORT_LABELS } from '../../utils/format';
import { needsRefund, orderCustomerName, orderPlace } from '../../utils/orders';
import usePageMeta from '../../utils/usePageMeta';

const PAGE_SIZE = 20;
const REFRESH_MS = 60000;
const DEFAULTS = { groupe: '', q: '', du: '', au: '', paiement: '', etat: '', page: '1' };

const TABS = [
  { value: '', label: 'Toutes', counter: 'all' },
  { value: 'pending', label: 'En attente', counter: 'pending' },
  { value: 'active', label: 'En cours', counter: 'active' },
  { value: 'delivered', label: 'Livrées', counter: 'delivered' },
  { value: 'cancelled', label: 'Annulées', counter: 'cancelled' },
];

const PAYMENT_METHODS = [
  { value: '', label: 'Tous les moyens' },
  { value: 'MTN_MOMO', label: 'MTN MoMo' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'CASH', label: 'Espèces' },
];

const PAYMENT_STATES = [
  { value: '', label: 'Tous les paiements' },
  { value: 'unpaid', label: 'À encaisser', status: 'PENDING,PROCESSING' },
  { value: 'paid', label: 'Payés', status: 'PAID' },
  { value: 'failed', label: 'Échoués / annulés', status: 'FAILED,CANCELLED' },
  { value: 'refunded', label: 'Remboursés', status: 'REFUNDED' },
];

const known = (list, value) => (list.some((item) => item.value === value) ? value : '');

// Filtres de l'adresse -> paramètres de l'API (valeurs inconnues ignorées : une adresse modifiée à la main ne casse rien).
function buildQuery(f) {
  const params = {};
  const group = known(TABS, f.groupe);
  if (group) params.group = group;
  if (f.q) params.search = f.q;
  if (f.du) params.from = f.du;
  if (f.au) params.to = f.au;
  const method = known(PAYMENT_METHODS, f.paiement);
  if (method) params.payment = method;
  const state = PAYMENT_STATES.find((s) => s.value === known(PAYMENT_STATES, f.etat));
  if (state?.status) params.paymentStatus = state.status;
  return params;
}

function PaymentCell({ order }) {
  const method = PAYMENT_METHOD_SHORT_LABELS[order.payment?.method] || '—';
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-sm text-ink/80">{method}</span>
      {needsRefund(order) ? (
        <span className="badge bg-red-100 text-red-700">À rembourser</span>
      ) : (
        <PaymentBadge status={order.payment?.status} method={order.payment?.method} />
      )}
    </div>
  );
}

export default function AdminOrders() {
  usePageMeta('Commandes');
  const [filters, setFilters] = useUrlFilters(DEFAULTS);
  const [exporting, setExporting] = useState(false);

  const group = known(TABS, filters.groupe);
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const query = buildQuery(filters);
  const { data, loading, error, reload } = useAdminList((params) => ordersApi.list(params), { ...query, page, limit: PAGE_SIZE }, { refreshMs: REFRESH_MS });

  const items = data?.items || [];
  const total = data?.total || 0;
  const counts = data?.counts || {};
  const hasFilters = Boolean(filters.q || filters.du || filters.au || filters.paiement || filters.etat);

  // Page au-delà de la dernière (filtre resserré, commandes supprimées) : retour à la dernière page existante.
  useEffect(() => {
    if (data && total > 0 && items.length === 0 && page > 1) setFilters({ page: Math.ceil(total / PAGE_SIZE) });
  }, [data, total, items.length, page, setFilters]);

  const change = (patch) => setFilters({ ...patch, page: 1 });
  const clearFilters = () => change({ q: '', du: '', au: '', paiement: '', etat: '' });

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadOrdersCsv(query);
      toast.success('Export téléchargé');
    } catch (err) {
      toast.error(err.message || "L'export n'a pas pu être téléchargé");
    } finally {
      setExporting(false);
    }
  };

  const tabs = TABS.map((t) => ({ value: t.value, label: t.label, count: data ? counts[t.counter] : undefined }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Commandes</h1>
          <p className="text-sm text-ink/55">Suivez, confirmez et faites livrer les commandes de vos clients.</p>
        </div>
        <button type="button" onClick={exportCsv} disabled={exporting} className="btn-secondary !px-4 !py-2 text-sm">
          <Download size={16} aria-hidden="true" /> {exporting ? 'Export…' : 'Exporter (CSV)'}
        </button>
      </div>

      <div className="mt-5">
        <TabBar tabs={tabs} value={group} onChange={(value) => change({ groupe: value })} label="Commandes par statut" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <SearchBox
          value={filters.q}
          onSearch={(q) => change({ q })}
          placeholder="Rechercher : n° de commande, nom, téléphone, quartier…"
          label="Rechercher une commande"
        />
        <DateRange from={filters.du} to={filters.au} onChange={change} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select
          aria-label="Moyen de paiement"
          className="input !w-auto !py-2 text-sm"
          value={known(PAYMENT_METHODS, filters.paiement)}
          onChange={(e) => change({ paiement: e.target.value })}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          aria-label="État du paiement"
          className="input !w-auto !py-2 text-sm"
          value={known(PAYMENT_STATES, filters.etat)}
          onChange={(e) => change({ etat: e.target.value })}
        >
          {PAYMENT_STATES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
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
            icon={ClipboardList}
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
            icon={ClipboardList}
            title={hasFilters || group ? 'Aucune commande trouvée' : 'Aucune commande pour le moment'}
            description={hasFilters ? 'Aucune commande ne correspond à ces filtres.' : group ? 'Aucune commande dans cet onglet.' : 'Les commandes de vos clients apparaîtront ici.'}
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
            {/* Tableau sur ordinateur, cartes sur téléphone */}
            <div className="card hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-left text-sm" data-testid="orders-table">
                <thead className="border-b border-line bg-mist/60 text-xs uppercase tracking-wide text-ink/50">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Commande</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Client</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Montant</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Paiement</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Statut</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                    <th scope="col" className="w-10 px-2 py-3"><span className="sr-only">Voir</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((o) => (
                    <tr key={o.id} className="transition hover:bg-mist/40" data-order={o.orderNumber}>
                      <td className="px-4 py-3 font-semibold text-ink">
                        <Link to={`/admin/commandes/${o.id}`} className="hover:text-brand-700 hover:underline">
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{orderCustomerName(o)}</p>
                        {orderPlace(o) && <p className="text-xs text-ink/50">{orderPlace(o)}</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-ink">{formatFCFA(o.total)}</td>
                      <td className="px-4 py-3">
                        <PaymentCell order={o} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink/60">{formatShortDate(o.createdAt)}</td>
                      <td className="px-2 py-3 text-right">
                        <Link to={`/admin/commandes/${o.id}`} aria-label={`Voir la commande ${o.orderNumber}`} className="inline-flex rounded-full p-1.5 text-ink/40 hover:bg-mist hover:text-ink">
                          <ChevronRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 md:hidden" data-testid="orders-cards">
              {items.map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/commandes/${o.id}`} className="card block p-4 transition active:bg-mist/60" data-order={o.orderNumber}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-ink">{o.orderNumber}</p>
                        <p className="truncate text-sm text-ink/70">{orderCustomerName(o)}</p>
                        {orderPlace(o) && <p className="truncate text-xs text-ink/50">{orderPlace(o)}</p>}
                      </div>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <PaymentCell order={o} />
                      <div className="text-right">
                        <p className="font-display font-bold text-ink">{formatFCFA(o.total)}</p>
                        <p className="text-xs text-ink/50">{formatShortDate(o.createdAt)}</p>
                      </div>
                    </div>
                  </Link>
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
