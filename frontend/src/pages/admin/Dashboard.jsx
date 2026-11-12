import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { ArrowRight, Boxes, ClipboardList, Clock, Hourglass, PackageCheck, RefreshCw, Smartphone, Truck, Users, Wallet } from 'lucide-react';
import { statisticsApi } from '../../api/extras';
import { ordersApi } from '../../api/orders';
import { StatCardSkeleton } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import StatCard from '../../components/admin/StatCard';
import useUrlFilters from '../../hooks/useUrlFilters';
import usePageMeta from '../../utils/usePageMeta';
import { formatFCFA, formatShortDate, PAYMENT_METHOD_LABELS } from '../../utils/format';
import { orderCustomerName } from '../../utils/orders';

const PERIODS = [7, 30, 90];
const DEFAULTS = { jours: '30' };
const REFRESH_MS = 60000;

// Couleurs de marque des moyens de paiement (jaune MTN, orange Orange Money, vert marque pour les especes).
const PAYMENT_COLORS = { MTN_MOMO: '#FFC107', ORANGE_MONEY: '#FF6B00', CASH: '#279C5A' };

const dayLabel = (key, options) => new Date(`${key}T12:00:00Z`).toLocaleDateString('fr-FR', { ...options, timeZone: 'UTC' });
const shortAxis = (value) => (value >= 1000000 ? `${Math.round(value / 100000) / 10} M` : value >= 1000 ? `${Math.round(value / 1000)} k` : value);

function PeriodSelector({ value, onChange }) {
  return (
    <div role="group" aria-label="Période affichée" className="inline-flex rounded-full bg-mist p-1">
      {PERIODS.map((days) => (
        <button
          key={days}
          type="button"
          aria-pressed={value === days}
          onClick={() => onChange(days)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${value === days ? 'bg-white text-ink shadow-sm' : 'text-ink/55 hover:text-ink'}`}
        >
          {days} jours
        </button>
      ))}
    </div>
  );
}

function SalesCard({ sales, days, selector }) {
  const chartData = (sales?.dailyRevenue || []).map((d) => ({ ...d, label: dayLabel(d.date, { day: 'numeric', month: 'short' }) }));
  const hasSales = (sales?.ordersCount || 0) > 0;

  return (
    <div className="card p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-ink">Ventes — {days} derniers jours</h2>
          {sales && !sales.failed && (
            <p className="mt-0.5 text-sm text-ink/55" data-testid="sales-summary">
              <span className="font-semibold text-ink">{formatFCFA(sales.revenue)}</span> · {sales.ordersCount} commande{sales.ordersCount > 1 ? 's' : ''} · panier moyen {formatFCFA(sales.averageOrder)}
            </p>
          )}
        </div>
        {selector}
      </div>

      {sales === null ? (
        <div className="skeleton mt-4 h-64 w-full rounded-xl" aria-hidden="true" />
      ) : sales.failed ? (
        <p className="mt-6 text-sm text-red-700">Les ventes n'ont pas pu être chargées. Utilisez « Actualiser ».</p>
      ) : !hasSales ? (
        <p className="mt-6 rounded-xl bg-mist px-4 py-8 text-center text-sm text-ink/50">Aucune vente sur cette période.</p>
      ) : (
        <div className="mt-4" role="img" aria-label={`Courbe du chiffre d'affaires sur ${days} jours`}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E1E6E0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fontSize: 11 }} width={44} tickFormatter={shortAxis} />
              <Tooltip
                formatter={(value, _name, item) => [`${formatFCFA(value)} · ${item.payload.orders} commande(s)`, "Chiffre d'affaires"]}
                labelFormatter={(_label, items) => (items?.[0] ? dayLabel(items[0].payload.date, { weekday: 'long', day: 'numeric', month: 'long' }) : '')}
              />
              <Line type="monotone" dataKey="total" name="CA" stroke="#279C5A" strokeWidth={2.5} dot={days <= 30 ? { r: 3 } : false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function PaymentBreakdownCard({ data, days }) {
  const total = (data || []).reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-ink">Répartition des paiements</h2>
      <p className="text-xs text-ink/45">Paiements encaissés · {days} derniers jours</p>

      {data === null ? (
        <div className="skeleton mt-4 h-52 w-full rounded-xl" aria-hidden="true" />
      ) : total === 0 ? (
        <p className="mt-6 text-sm text-ink/40">Aucun paiement encaissé sur cette période.</p>
      ) : (
        <>
          <div className="relative mt-2">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="method" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none">
                  {data.map((d) => (
                    <Cell key={d.method} fill={PAYMENT_COLORS[d.method] || '#9CA3AF'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, _name, item) => [`${v} paiement(s) · ${formatFCFA(item.payload.amount)}`, PAYMENT_METHOD_LABELS[item.payload.method]]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-bold text-ink">{total}</span>
              <span className="text-[11px] text-ink/45">paiements</span>
            </div>
          </div>

          <ul className="mt-2 space-y-2" data-testid="payment-legend">
            {data.map((d) => (
              <li key={d.method} className="flex items-center gap-2 text-sm">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[d.method] || '#9CA3AF' }} />
                <span className="flex-1 text-ink/70">{PAYMENT_METHOD_LABELS[d.method] || d.method}</span>
                <span className="font-semibold text-ink">{d.percent}%</span>
                <span className="w-24 text-right text-xs text-ink/45">{formatFCFA(d.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// Petite tuile cliquable « à traiter » : se met en évidence (ambre) quand il y a quelque chose à faire.
function TodoTile({ icon: Icon, label, value, to, warn }) {
  const alert = warn && Number(value) > 0;
  return (
    <Link
      to={to}
      data-testid={`todo-${label}`}
      className={`flex items-center gap-3 rounded-xl2 border p-3.5 transition hover:shadow-md ${alert ? 'border-amber-300 bg-amber-50' : 'border-line bg-white hover:border-brand-600/40'}`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${alert ? 'bg-amber-200 text-amber-800' : 'bg-mist text-ink/60'}`}>
        <Icon size={17} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-lg font-bold leading-tight text-ink">{value}</span>
        <span className="block truncate text-xs text-ink/55">{label}</span>
      </span>
    </Link>
  );
}

export default function AdminDashboard() {
  usePageMeta('Tableau de bord');
  const [filters, setFilters] = useUrlFilters(DEFAULTS);
  const days = PERIODS.includes(Number(filters.jours)) ? Number(filters.jours) : 30;

  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState('');
  const [recentOrders, setRecentOrders] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sales, setSales] = useState(null);
  const [payments, setPayments] = useState(null);
  const [topProducts, setTopProducts] = useState(null);
  const periodRequest = useRef(0);

  // Indicateurs du jour + dernières commandes (rafraîchis tout seuls toutes les minutes).
  const loadSnapshot = useCallback(async () => {
    try {
      const [data, orders] = await Promise.all([statisticsApi.dashboard(), ordersApi.list({ limit: 6 }).catch(() => null)]);
      setStats(data);
      setStatsError('');
      setUpdatedAt(data.asOf ? new Date(data.asOf) : new Date());
      if (orders) setRecentOrders(orders.items || []);
      else setRecentOrders((current) => current ?? []);
    } catch (err) {
      setStatsError(err.message || 'Chargement impossible');
    }
  }, []);

  // Ventes, paiements et produits de la période choisie. Un changement de période rapide ne laisse pas
  // une ancienne réponse écraser la nouvelle (compteur de requêtes).
  const loadPeriod = useCallback(async (period) => {
    const id = (periodRequest.current += 1);
    setSales(null);
    setPayments(null);
    setTopProducts(null);
    const settle = (promise, set, fallback) =>
      promise.then((value) => id === periodRequest.current && set(value)).catch(() => id === periodRequest.current && set(fallback));
    await Promise.all([
      settle(statisticsApi.sales(period), setSales, { failed: true, dailyRevenue: [] }),
      settle(statisticsApi.paymentBreakdown({ days: period }), setPayments, []),
      settle(statisticsApi.products({ days: period, limit: 5 }), setTopProducts, []),
    ]);
  }, []);

  useEffect(() => {
    loadSnapshot();
    const tick = () => {
      if (document.visibilityState === 'visible') loadSnapshot();
    };
    const timer = setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [loadSnapshot]);

  useEffect(() => {
    loadPeriod(days);
  }, [days, loadPeriod]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadSnapshot(), loadPeriod(days)]);
    setRefreshing(false);
  };

  if (!stats) {
    if (statsError) {
      return (
        <EmptyState
          icon={ClipboardList}
          title="Chargement impossible"
          description={statsError}
          action={
            <button type="button" onClick={loadSnapshot} className="btn-primary mt-2">
              Réessayer
            </button>
          }
        />
      );
    }
    return <StatCardSkeleton count={4} />;
  }

  const drivers = stats.drivers || {};
  const totalDrivers = (drivers.available || 0) + (drivers.busy || 0) + (drivers.offline || 0) + (drivers.suspended || 0);
  const deltas = stats.deltas || {};
  const maxRevenue = Math.max(1, ...(topProducts || []).map((p) => p.revenue || 0));
  const updatedLabel = updatedAt ? updatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' }) : '';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Tableau de bord</h1>
        <div className="flex items-center gap-2 text-xs text-ink/50">
          {updatedLabel && <span>Mis à jour à {updatedLabel}</span>}
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink/70 transition hover:bg-mist disabled:opacity-60"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" /> Actualiser
          </button>
        </div>
      </div>

      {statsError && (
        <p role="alert" className="mt-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Actualisation impossible pour le moment : les chiffres affichés peuvent ne pas être à jour.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={ClipboardList}
          label="Commandes aujourd'hui"
          value={stats.ordersToday ?? 0}
          delta={deltas.orders}
          deltaSuffix="vs hier"
          sub={deltas.orders == null ? `Hier : ${stats.ordersYesterday ?? 0}` : undefined}
          to="/admin/commandes"
          testId="kpi-orders"
        />
        <StatCard
          icon={Wallet}
          label="Chiffre d'affaires du mois"
          value={formatFCFA(stats.revenueMonth)}
          delta={deltas.revenueMonth}
          deltaSuffix="vs mois dernier"
          sub={`${formatFCFA(stats.revenueToday)} aujourd'hui`}
          tone="sky"
          to="/admin/statistiques"
          testId="kpi-revenue"
        />
        <StatCard
          icon={Truck}
          label="Livraisons en cours"
          value={stats.deliveriesInProgress ?? 0}
          sub={`${drivers.available || 0} livreur${(drivers.available || 0) > 1 ? 's' : ''} disponible${(drivers.available || 0) > 1 ? 's' : ''}`}
          tone="violet"
          to="/admin/livraisons?groupe=active"
          testId="kpi-deliveries"
        />
        <StatCard
          icon={Users}
          label="Clients"
          value={stats.totalClients ?? 0}
          delta={deltas.newClients}
          deltaSuffix="vs mois dernier"
          sub={`${stats.newClientsMonth ?? 0} nouveau${(stats.newClientsMonth ?? 0) > 1 ? 'x' : ''} ce mois`}
          tone="amber"
          to="/admin/clients"
          testId="kpi-clients"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <TodoTile icon={Hourglass} label="Commandes en attente" value={stats.ordersPending ?? 0} to="/admin/commandes?groupe=pending" warn />
        <TodoTile icon={Clock} label="Commandes en cours" value={stats.ordersInProgress ?? 0} to="/admin/commandes?groupe=active" />
        <TodoTile icon={Smartphone} label="Mobile Money à vérifier" value={stats.mobileMoneyToVerify ?? 0} to="/admin/paiements?groupe=pending" warn />
        <TodoTile icon={Boxes} label="Produits en stock faible" value={stats.lowStockCount ?? 0} to="/admin/produits?stock=low" warn />
        <TodoTile icon={PackageCheck} label="Livreurs disponibles" value={`${drivers.available || 0} / ${totalDrivers}`} to="/admin/livreurs" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SalesCard sales={sales} days={days} selector={<PeriodSelector value={days} onChange={(d) => setFilters({ jours: d })} />} />
        <PaymentBreakdownCard data={payments} days={days} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-ink">Dernières commandes</h2>
            <Link to="/admin/commandes" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
              Tout voir <ArrowRight size={14} />
            </Link>
          </div>
          {recentOrders === null ? (
            <div className="skeleton mt-4 h-40 w-full rounded-xl" aria-hidden="true" />
          ) : recentOrders.length === 0 ? (
            <p className="mt-4 text-sm text-ink/40">Aucune commande pour l'instant.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line" data-testid="recent-orders">
              {recentOrders.map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/commandes/${o.id}`} className="flex items-center gap-3 py-3 transition hover:bg-mist/50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{o.orderNumber}</p>
                      <p className="truncate text-xs text-ink/50">
                        {orderCustomerName(o)} · {formatShortDate(o.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={o.status} />
                    <span className="w-24 text-right text-sm font-semibold text-ink">{formatFCFA(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-ink">Produits les plus vendus</h2>
            <Link to="/admin/statistiques" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
              Détails <ArrowRight size={14} />
            </Link>
          </div>
          <p className="text-xs text-ink/45">{days} derniers jours</p>
          {topProducts === null ? (
            <div className="skeleton mt-4 h-40 w-full rounded-xl" aria-hidden="true" />
          ) : topProducts.length === 0 ? (
            <p className="mt-4 text-sm text-ink/40">Pas de ventes sur cette période.</p>
          ) : (
            <ul className="mt-4 space-y-3" data-testid="top-products">
              {topProducts.map((p) => (
                <li key={p.productId || p.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-ink">{p.name}</span>
                    <span className="shrink-0 text-xs text-ink/50">{formatFCFA(p.revenue)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-mist">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(4, ((p.revenue || 0) / maxRevenue) * 100)}%` }} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink/40">{p.quantitySold} vendu(s)</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
