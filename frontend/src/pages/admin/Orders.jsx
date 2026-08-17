import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ordersApi } from '../../api/orders';
import { RowSkeleton } from '../../components/Skeleton';
import StatusBadge from '../../components/StatusBadge';
import { formatFCFA, formatDate, ORDER_STATUS_LABELS } from '../../utils/format';

export default function AdminOrders() {
  const [orders, setOrders] = useState(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const load = () => {
    setOrders(null);
    ordersApi.list({ status: status || undefined, search: search || undefined, limit: 50 }).then((r) => setOrders(r.items));
  };

  useEffect(() => { load(); }, [status]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Commandes</h1>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setStatus('')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!status ? 'bg-pine-900 text-white' : 'bg-mist text-ink/60'}`}>Toutes</button>
          {Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => (
            <button key={v} onClick={() => setStatus(v)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === v ? 'bg-pine-900 text-white' : 'bg-mist text-ink/60'}`}>{l}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 sm:ml-auto">
          <Search size={15} className="text-ink/40" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="N° commande, client, téléphone" className="w-56 border-0 bg-transparent text-sm focus:outline-none" />
        </form>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl2 border border-line bg-white">
        {orders === null ? (
          <div className="p-4"><RowSkeleton count={6} /></div>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3">Commande</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-mist/50">
                  <td className="px-4 py-3">
                    <Link to={`/admin/commandes/${o.id}`} className="font-medium text-ink hover:text-brand-700">{o.orderNumber}</Link>
                  </td>
                  <td className="px-4 py-3 text-ink/60">{o.customer ? `${o.customer.user.firstName} ${o.customer.user.lastName}` : o.guestName}</td>
                  <td className="px-4 py-3 text-ink/60">{o.deliveryZone?.name}</td>
                  <td className="px-4 py-3 font-medium text-ink">{formatFCFA(o.total)}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-ink/50">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-ink/40">Aucune commande</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
