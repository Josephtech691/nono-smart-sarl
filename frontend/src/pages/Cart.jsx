import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, ArrowRight, BadgePercent } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { formatFCFA, UNIT_LABELS } from '../utils/format';
import { getUnitPriceForQuantity } from '../utils/pricing';
import QuantityStepper from '../components/QuantityStepper';
import EmptyState from '../components/EmptyState';

export default function Cart() {
  const { items, updateQuantity, removeItem, subtotal } = useCartStore();
  const { user } = useAuthStore();
  const customer = user?.customerProfile;
  const isWholesale = customer?.customerType === 'PROFESSIONNEL' && customer?.professionalStatus === 'APPROVED';
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={ShoppingCart}
          title="Votre panier est vide"
          description="Parcourez notre catalogue de silures frais et d'alevins pour commencer."
          action={
            <Link to="/produits" className="btn-primary mt-2">
              Voir les produits
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">Mon panier</h1>
        {isWholesale && (
          <span className="badge bg-amber-100 text-amber-800">
            <BadgePercent size={13} /> Tarif pro -{customer.wholesaleDiscountPercent}%
          </span>
        )}
      </div>

      <div className="mt-6 divide-y divide-line rounded-xl2 border border-line bg-white">
        {items.map((item) => {
          const unitPrice = getUnitPriceForQuantity(item, item.quantity, customer);
          const lineTotal = Math.round(unitPrice * item.quantity);
          return (
            <div key={item.productId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-mist">
                {item.image && <img src={item.image} alt={item.name} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <Link to={`/produits/${item.slug}`} className="font-display font-semibold text-ink hover:text-brand-700">
                  {item.name}
                </Link>
                <p className="text-sm text-ink/50">
                  {formatFCFA(unitPrice)} / {UNIT_LABELS[item.unit]}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <QuantityStepper
                  value={item.quantity}
                  onChange={(q) => updateQuantity(item.productId, q)}
                  min={item.minOrderQuantity}
                  max={item.stockAvailable}
                  step={item.unit === 'KILOGRAM' || item.unit === 'GRAM' ? 0.5 : 1}
                />
                <p className="w-24 text-right font-display font-bold text-ink">{formatFCFA(lineTotal)}</p>
                <button
                  onClick={() => removeItem(item.productId)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-ink/40 transition hover:bg-red-50 hover:text-red-600"
                  aria-label="Retirer du panier"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col items-end gap-3">
        <div className="flex w-full max-w-xs justify-between text-sm text-ink/60 sm:w-64">
          <span>Sous-total</span>
          <span className="font-semibold text-ink">{formatFCFA(subtotal(customer))}</span>
        </div>
        <p className="text-xs text-ink/45">Les frais de livraison sont calculés à l'étape suivante.</p>
        <button onClick={() => navigate('/checkout')} className="btn-primary">
          Passer la commande <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
