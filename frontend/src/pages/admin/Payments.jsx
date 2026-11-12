import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, CreditCard, Hourglass, RotateCcw, Undo2 } from 'lucide-react';
import { paymentsApi } from '../../api/orders';
import EmptyState from '../../components/EmptyState';
import PaymentBadge from '../../components/PaymentBadge';
import { RowSkeleton } from '../../components/Skeleton';
import DateRange from '../../components/admin/DateRange';
import PaymentActionModal from '../../components/admin/PaymentActionModal';
import Pagination from '../../components/admin/Pagination';
import SearchBox from '../../components/admin/SearchBox';
import StatCard from '../../components/admin/StatCard';
import TabBar from '../../components/admin/TabBar';
import useAdminList from '../../hooks/useAdminList';
import useUrlFilters from '../../hooks/useUrlFilters';
import { formatFCFA, formatPhone, formatShortDate, PAYMENT_METHOD_SHORT_LABELS } from '../../utils/format';
import usePageMeta from '../../utils/usePageMeta';

const PAGE_SIZE = 20;
const REFRESH_MS = 60000;
const DEFAULTS = { groupe: '', methode: '', q: '', du: '', au: '', page: '1' };

// Onglet -> paramètres de l'API. « À rembourser » est une vue (payé sur une commande annulée), pas un état.
const TABS = [
  { value: '', label: 'Tous', counter: 'all', query: {} },
  { value: 'pending', label: 'En attente', counter: 'pending', query: { status: 'PENDING,PROCESSING' } },
  { value: 'paid', label: 'Payés', counter: 'paid', query: { status: 'PAID' } },
  { value: 'failed', label: 'Échoués', counter: 'failed', query: { status: 'FAILED' } },
  { value: 'cancelled', label: 'Annulés', counter: 'cancelled', query: { status: 'CANCELLED' } },
  { value: 'refund', label: 'À rembourser', counter: 'refundDue', query: { view: 'refund' }, alert: true },
  { value: 'refunded', label: 'Remboursés', counter: 'refunded', query: { status: 'REFUNDED' } },
];

const METHODS = [
  { value: '', label: 'Tous les moyens' },
  { value: 'MTN_MOMO', label: 'MTN MoMo' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'CASH', label: 'Espèces' },
];

const knownTab = (value) => (TABS.some((t) => t.value === value) ? value : '');
const knownMethod = (value) => (METHODS.some((m) => m.value === value) ? value : '');

function buildQuery(f) {
  const params = { ...TABS.find((t) => t.value === knownTab(f.groupe)).query };
  if (knownMethod(f.methode)) params.method = f.methode;
  if (f.q) params.search = f.q;
  if (f.du) params.from = f.du;
  if (f.au) params.to = f.au;
  return params;
}

// Un paiement non encaissé ou échoué peut être constaté à la main, sauf si la commande est annulée.
const canMarkPaid = (row) => ['PENDING', 'PROCESSING', 'FAILED'].includes(row.status) && row.orderStatus !== 'CANCELLED';

function StatusCell({ row }) {
  if (row.refundDue) return <span className="badge bg-red-100 text-red-700">À rembourser</span>;
  return <PaymentBadge status={row.status} method={row.method} />;
}

function RowActions({ row, onAction }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canMarkPaid(row) && (
        <button type="button" onClick={() => onAction('paid', row)} className="btn-primary !px-3 !py-1.5 text-xs">
          <BadgeCheck size={14} aria-hidden="true" /> {row.method === 'CASH' ? 'Espèces encaissées' : 'Marquer payé'}
        </button>
      )}
      {row.refundDue && (
        <button type="button" onClick={() => onAction('refund', row)} className="btn-secondary !border-red-300 !px-3 !py-1.5 text-xs !text-red-700 hover:!bg-red-50">
          <Undo2 size={14} aria-hidden="true" /> Marquer remboursé
        </button>
      )}
    </div>
  );
}

const Zero = { count: 0, amount: 0 };
const count = (n) => `${n} paiement${n > 1 ? 's' : ''}`;

export default function AdminPayments() {
  usePageMeta('Paiements');
  const [filters, setFilters] = useUrlFilters(DEFAULTS);
  const [action, setAction] = useState(null); // { mode: 'paid' | 'refund', row }

  const group = knownTab(filters.groupe);
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const query = buildQuery(filters);
  const { data, loading, error, reload } = useAdminList((params) => paymentsApi.list(params), { ...query, page, limit: PAGE_SIZE }, { refreshMs: REFRESH_MS });

  const items = data?.items || [];
  const total = data?.total || 0;
  const summary = data?.summary || {};
  const hasFilters = Boolean(filters.methode || filters.q || filters.du || filters.au);

  useEffect(() => {
    if (data && total > 0 && items.length === 0 && page > 1) setFilters({ page: Math.ceil(total / PAGE_SIZE) });
  }, [data, total, items.length, page, setFilters]);

  const change = (patch) => setFilters({ ...patch, page: 1 });
  const clearFilters = () => change({ methode: '', q: '', du: '', au: '' });
  const tabs = TABS.map((t) => ({ value: t.value, label: t.label, alert: t.alert, count: data ? (summary[t.counter] || Zero).count : undefined }));
  const paid = summary.paid || Zero;
  const pending = summary.pending || Zero;
  const refundDue = summary.refundDue || Zero;
  const refunded = summary.refunded || Zero;

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-ink">Paiements</h1>
        <p className="text-sm text-ink/55">Vérifiez les paiements Mobile Money, suivez les espèces et gérez les remboursements.</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" data-testid="payment-summary">
        <StatCard icon={BadgeCheck} label="Encaissé" value={formatFCFA(paid.amount)} sub={count(paid.count)} to="/admin/paiements?groupe=paid" testId="sum-paid" />
        <StatCard icon={Hourglass} label="En attente d'encaissement" value={formatFCFA(pending.amount)} sub={count(pending.count)} tone="amber" to="/admin/paiements?groupe=pending" testId="sum-pending" />
        <StatCard icon={Undo2} label="À rembourser" value={formatFCFA(refundDue.amount)} sub={count(refundDue.count)} tone="red" to="/admin/paiements?groupe=refund" testId="sum-refund" />
        <StatCard icon={RotateCcw} label="Remboursés" value={formatFCFA(refunded.amount)} sub={count(refunded.count)} tone="violet" to="/admin/paiements?groupe=refunded" testId="sum-refunded" />
      </div>

      <div className="mt-6">
        <TabBar tabs={tabs} value={group} onChange={(value) => change({ groupe: value })} label="Paiements par état" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <SearchBox value={filters.q} onSearch={(q) => change({ q })} placeholder="Rechercher : n° de commande, client, téléphone…" label="Rechercher un paiement" />
        <DateRange from={filters.du} to={filters.au} onChange={change} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select aria-label="Moyen de paiement" className="input !w-auto !py-2 text-sm" value={knownMethod(filters.methode)} onChange={(e) => change({ methode: e.target.value })}>
          {METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
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
            icon={CreditCard}
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
            icon={CreditCard}
            title={hasFilters || group ? 'Aucun paiement trouvé' : 'Aucun paiement pour le moment'}
            description={hasFilters ? 'Aucun paiement ne correspond à ces filtres.' : group ? 'Aucun paiement dans cet onglet.' : 'Les paiements des commandes apparaissent ici.'}
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
              <table className="w-full min-w-[900px] text-left text-sm" data-testid="payments-table">
                <thead className="border-b border-line bg-mist/60 text-xs uppercase tracking-wide text-ink/50">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Commande</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Client</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Montant</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Moyen</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Statut</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((row) => (
                    <tr key={row.id} className="align-top transition hover:bg-mist/40" data-order={row.orderNumber}>
                      <td className="px-4 py-3">
                        <Link to={`/admin/commandes/${row.orderId}`} className="font-semibold text-ink hover:text-brand-700 hover:underline">
                          {row.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{row.customerName}</p>
                        {row.customerPhone && <p className="text-xs text-ink/50">{formatPhone(row.customerPhone)}</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-ink">{formatFCFA(row.amount)}</td>
                      <td className="px-4 py-3">
                        <p className="text-ink/80">{PAYMENT_METHOD_SHORT_LABELS[row.method] || row.method}</p>
                        {row.method !== 'CASH' && row.phoneNumber && <p className="text-xs text-ink/50">{formatPhone(row.phoneNumber)}</p>}
                        {row.transactionRef && <p className="break-all text-xs text-ink/50">Réf. {row.transactionRef}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusCell row={row} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink/60">{formatShortDate(row.createdAt)}</td>
                      <td className="px-4 py-3">
                        <RowActions row={row} onAction={(mode, r) => setAction({ mode, row: r })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 md:hidden" data-testid="payments-cards">
              {items.map((row) => (
                <li key={row.id} className="card p-4" data-order={row.orderNumber}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/admin/commandes/${row.orderId}`} className="font-display font-semibold text-ink hover:text-brand-700">
                        {row.orderNumber}
                      </Link>
                      <p className="truncate text-sm text-ink/70">{row.customerName}</p>
                    </div>
                    <StatusCell row={row} />
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="text-sm text-ink/70">
                      <p>{PAYMENT_METHOD_SHORT_LABELS[row.method] || row.method}</p>
                      {row.method !== 'CASH' && row.phoneNumber && <p className="text-xs text-ink/50">{formatPhone(row.phoneNumber)}</p>}
                      <p className="text-xs text-ink/45">{formatShortDate(row.createdAt)}</p>
                    </div>
                    <p className="font-display text-lg font-bold text-ink">{formatFCFA(row.amount)}</p>
                  </div>
                  {(canMarkPaid(row) || row.refundDue) && (
                    <div className="mt-3 border-t border-line pt-3">
                      <RowActions row={row} onAction={(mode, r) => setAction({ mode, row: r })} />
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-5">
              <Pagination page={page} limit={PAGE_SIZE} total={total} onChange={(p) => { setFilters({ page: p }); window.scrollTo({ top: 0 }); }} />
            </div>
          </>
        )}
      </div>

      <PaymentActionModal
        mode={action?.mode}
        target={
          action
            ? { orderId: action.row.orderId, orderNumber: action.row.orderNumber, amount: action.row.amount, method: action.row.method, orderStatus: action.row.orderStatus }
            : null
        }
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          reload();
        }}
      />
    </div>
  );
}
