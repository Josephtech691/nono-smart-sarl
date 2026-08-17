import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageSearch, RotateCcw } from 'lucide-react';
import { ordersApi } from '../../api/orders';
import { useCartStore } from '../../store/cartStore';
import AccountNav from '../../components/AccountNav';
import StatusBadge from '../../components/StatusBadge';
import { RowSkeleton } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import { formatFCFA, formatDate } from '../../utils/format';

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    ordersApi.list().then((r) => setOrders(r.items)).catch(() => setOrders([]));
  }, []);

  // "Recommander une ancienne commande" (section 48) : ajoute au panier les
  // produits de la commande passee (le prix et le stock seront revalides a
  // l'ajout / au checkout).
  const reorder = (order) => {
    order.items.forEach((it) => {
      addItem({ id: it.productId, name: it.name, slug: it.productId, price: it.unitPrice, unit: 'KILOGRAM', priceTiers: [], minOrderQuantity: 1, stockQuantity: 999999, reservedQuantity: 0 }, it.quantity);
    });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Mon compte</h1>
      <AccountNav />

      {orders === null ? (
        <RowSkeleton count={4} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Aucune commande pour le moment"
          description="Vos commandes apparaîtront ici."
          action={<Link to="/produits" className="btn-primary mt-2">Voir les produits</Link>}
        />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Link to={`/compte/commandes/${o.id}`} className="font-display font-semibold text-ink hover:text-brand-700">
                    {o.orderNumber}
                  </Link>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-1 text-xs text-ink/50">{formatDate(o.createdAt)} · {o.items.length} article(s)</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-display font-bold text-ink">{formatFCFA(o.total)}</p>
                <button onClick={() => reorder(o)} className="btn-secondary !px-3 !py-2 text-xs" title="Recommander">
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
