import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ClipboardList, Wallet, Clock, Hourglass, Users, Truck } from 'lucide-react';
import { statisticsApi } from '../../api/extras';
import { StatCardSkeleton } from '../../components/Skeleton';
import { formatFCFA, formatDate } from '../../utils/format';

const CARDS = [
  { key: 'ordersToday', label: "Commandes aujourd'hui", icon: ClipboardList, format: (v) => v },
  { key: 'revenueToday', label: "Chiffre d'affaires (jour)", icon: Wallet, format: formatFCFA },
  { key: 'ordersInProgress', label: 'Commandes en cours', icon: Clock, format: (v) => v },
  { key: 'ordersPending', label: 'Commandes en attente', icon: Hourglass, format: (v) => v },
  { key: 'totalClients', label: 'Clients', icon: Users, format: (v) => v },
  { key: 'activeDrivers', label: 'Livreurs disponibles', icon: Truck, format: (v) => v },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [sales, setSales] = useState(null);

  useEffect(() => {
    statisticsApi.dashboard().then(setStats);
    statisticsApi.sales(14).then(setSales);
  }, []);

  if (!stats) return <StatCardSkeleton count={6} />;

  const chartData = (sales?.dailyRevenue || []).map((d) => ({ ...d, label: formatDate(d.date).replace(/\s\d{2}:\d{2}$/, '') }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Tableau de bord</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {CARDS.map(({ key, label, icon: Icon, format }) => (
          <div key={key} className="card animate-fade-up p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10 text-brand-700">
              <Icon size={18} />
            </span>
            <p className="mt-3 text-xs text-ink/50">{label}</p>
            <p className="font-display text-2xl font-bold text-ink">{format(stats[key])}</p>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-5">
        <h2 className="font-display font-semibold text-ink">Chiffre d'affaires — 14 derniers jours</h2>
        {chartData.length === 0 ? (
          <p className="mt-4 text-sm text-ink/40">Pas encore assez de données.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E1E6E0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatFCFA(v)} />
              <Line type="monotone" dataKey="total" name="CA" stroke="#279C5A" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
