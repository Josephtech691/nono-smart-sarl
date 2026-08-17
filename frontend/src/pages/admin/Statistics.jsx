import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Truck, PackageSearch, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { statisticsApi } from '../../api/extras';
import { RowSkeleton } from '../../components/Skeleton';
import { formatFCFA, formatDate } from '../../utils/format';

const TABS = [
  { key: 'profit', label: 'Marges par produit', icon: TrendingUp },
  { key: 'customers', label: 'Meilleurs clients', icon: Users },
  { key: 'drivers', label: 'Performance livreurs', icon: Truck },
  { key: 'stock', label: 'Prévision de stock', icon: PackageSearch },
  { key: 'anomalies', label: 'Anomalies', icon: AlertTriangle },
];

export default function AdminStatistics() {
  const [tab, setTab] = useState('profit');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const loaders = {
      profit: statisticsApi.profitByProduct,
      customers: statisticsApi.topCustomers,
      drivers: statisticsApi.driverPerformance,
      stock: statisticsApi.stockForecast,
      anomalies: statisticsApi.anomalies,
    };
    loaders[tab]()
      .then((res) => setData((d) => ({ ...d, [tab]: res })))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Statistiques avancées</h1>
      <p className="mt-1 text-sm text-ink/50">Business Intelligence — marges, clients, livreurs, stock, anomalies (section 76 du cahier des charges).</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
              tab === key ? 'bg-pine-900 text-white' : 'bg-white text-ink/60 hover:bg-mist'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading ? (
          <RowSkeleton count={6} />
        ) : tab === 'profit' ? (
          <ProfitByProduct items={data.profit || []} />
        ) : tab === 'customers' ? (
          <TopCustomers items={data.customers || []} />
        ) : tab === 'drivers' ? (
          <DriverPerformance items={data.drivers || []} />
        ) : tab === 'stock' ? (
          <StockForecast items={data.stock || []} />
        ) : (
          <Anomalies data={data.anomalies} />
        )}
      </div>
    </div>
  );
}

function ProfitByProduct({ items }) {
  if (!items.length) return <EmptyNote text="Pas encore assez de commandes livrées pour calculer les marges." />;
  return (
    <div className="space-y-5">
      <div className="card p-5">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={items}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E1E6E0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => formatFCFA(v)} />
            <Legend />
            <Bar dataKey="revenue" name="Chiffre d'affaires" fill="#155039" radius={[4, 4, 0, 0]} />
            <Bar dataKey="cost" name="Coût" fill="#D97706" radius={[4, 4, 0, 0]} />
            <Bar dataKey="profit" name="Bénéfice" fill="#279C5A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto rounded-xl2 border border-line bg-white">
        <table className="w-full min-w-[500px] text-left text-sm">
          <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-ink/50">
            <tr><th className="px-4 py-3">Produit</th><th className="px-4 py-3">CA</th><th className="px-4 py-3">Coût</th><th className="px-4 py-3">Bénéfice</th><th className="px-4 py-3">Marge</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((p) => (
              <tr key={p.productId}>
                <td className="px-4 py-3 font-medium text-ink">{p.name}</td>
                <td className="px-4 py-3 text-ink/60">{formatFCFA(p.revenue)}</td>
                <td className="px-4 py-3 text-ink/60">{formatFCFA(p.cost)}</td>
                <td className="px-4 py-3 font-medium text-brand-700">{formatFCFA(p.profit)}</td>
                <td className="px-4 py-3 text-ink/60">{p.marginPercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TopCustomers({ items }) {
  if (!items.length) return <EmptyNote text="Aucune commande de client identifié pour le moment." />;
  return (
    <div className="overflow-x-auto rounded-xl2 border border-line bg-white">
      <table className="w-full min-w-[500px] text-left text-sm">
        <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-ink/50">
          <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Commandes</th><th className="px-4 py-3">Total dépensé</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((c, i) => (
            <tr key={c.customerId}>
              <td className="px-4 py-3 text-ink/40">{i + 1}</td>
              <td className="px-4 py-3 font-medium text-ink">
                {c.name}
                {c.customerType === 'PROFESSIONNEL' && <span className="badge ml-1.5 bg-amber-100 text-amber-800">Pro</span>}
              </td>
              <td className="px-4 py-3 text-ink/60">{c.ordersCount}</td>
              <td className="px-4 py-3 font-medium text-brand-700">{formatFCFA(c.totalSpent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DriverPerformance({ items }) {
  if (!items.length) return <EmptyNote text="Aucun livreur enregistré." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((d) => (
        <div key={d.driverId} className="card p-4">
          <p className="font-display font-semibold text-ink">{d.name}</p>
          <p className="text-xs text-ink/50">{d.status}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div><p className="text-xs text-ink/40">Livraisons</p><p className="font-semibold text-ink">{d.deliveriesCount}</p></div>
            <div><p className="text-xs text-ink/40">Délai moyen</p><p className="font-semibold text-ink">{d.avgDeliveryMinutes != null ? `${d.avgDeliveryMinutes} min` : '-'}</p></div>
          </div>
          {d.cashIssues > 0 && (
            <p className="mt-2 flex items-center gap-1 text-xs text-amber-700"><AlertTriangle size={12} /> {d.cashIssues} écart(s) de caisse</p>
          )}
        </div>
      ))}
    </div>
  );
}

function StockForecast({ items }) {
  if (!items.length) return <EmptyNote text="Aucun produit actif." />;
  return (
    <div className="overflow-x-auto rounded-xl2 border border-line bg-white">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-ink/50">
          <tr><th className="px-4 py-3">Produit</th><th className="px-4 py-3">Disponible</th><th className="px-4 py-3">Ventes/jour (moy.)</th><th className="px-4 py-3">Rupture estimée</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((p) => (
            <tr key={p.productId} className={p.alert ? 'bg-red-50/50' : ''}>
              <td className="px-4 py-3 font-medium text-ink">{p.name}</td>
              <td className="px-4 py-3 text-ink/60">{p.available}</td>
              <td className="px-4 py-3 text-ink/60">{p.avgDailySales}</td>
              <td className="px-4 py-3">
                {p.daysUntilStockout == null ? (
                  <span className="text-ink/40">Pas de ventes récentes</span>
                ) : (
                  <span className={`badge ${p.alert ? 'bg-red-100 text-red-700' : 'bg-brand-500/15 text-brand-700'}`}>
                    {p.alert && <AlertTriangle size={12} />} {p.daysUntilStockout} j
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Anomalies({ data }) {
  if (!data) return <EmptyNote text="Chargement..." />;
  const { baseline, anomalies } = data;
  return (
    <div className="space-y-4">
      <div className="card flex gap-6 p-4 text-sm text-ink/60">
        <span>Moyenne commandes/jour : <strong className="text-ink">{baseline.avgOrdersPerDay}</strong></span>
        <span>Moyenne CA/jour : <strong className="text-ink">{formatFCFA(baseline.avgRevenuePerDay)}</strong></span>
      </div>
      {anomalies.length === 0 ? (
        <div className="card flex items-center gap-3 p-5 text-sm text-brand-700">
          <CheckCircle2 size={18} /> Aucune anomalie détectée sur les 21 derniers jours.
        </div>
      ) : (
        anomalies.map((a) => (
          <div key={a.date} className="card border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center justify-between">
              <p className="font-display font-semibold text-ink">{formatDate(a.date)}</p>
              <span className="text-xs text-ink/50">{a.ordersCount} commandes · {formatFCFA(a.revenue)}</span>
            </div>
            <ul className="mt-1.5 space-y-0.5">
              {a.reasons.map((r) => (
                <li key={r} className="flex items-center gap-1.5 text-sm text-amber-800"><AlertTriangle size={12} /> {r}</li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

function EmptyNote({ text }) {
  return <div className="card p-8 text-center text-sm text-ink/40">{text}</div>;
}
