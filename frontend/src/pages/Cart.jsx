import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, ArrowRight, BadgePercent, Fish, Truck, Lock } from 'lucide-react';
import { useCartStore, lineKey } from '../store/cartStore';
import { usePricesStore } from '../store/pricesStore';
import { FLAT_DELIVERY_FEE } from '../config';
import { useAuthStore } from '../store/authStore';
import { formatFCFA, formatQuantity, UNIT_LABELS } from '../utils/format';
import { getUnitPriceForQuantity, nextTierHint } from '../utils/pricing';
import usePageMeta from '../utils/usePageMeta';
import QuantityStepper from '../components/QuantityStepper';
import EmptyState from '../components/EmptyState';

export default function Cart() {
  const { items, updateQuantity, removeItem, subtotal } = useCartStore();
  const { user } = useAuthStore();
  const customer = user?.customerProfile;
  const specialPrices = usePricesStore((st) => st.prices);
  const isWholesale = customer?.customerType === 'PROFESSIONNEL' && customer?.professionalStatus === 'APPROVED';
  const navigate = useNavigate();

  usePageMeta('Mon panier');

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

  const isWeight = (unit) => unit === 'KILOGRAM' || unit === 'GRAM';
  const subtotalValue = subtotal(customer, specialPrices);
  const hasSpecialPrice = items.some((i) => specialPrices.some((p) => p.productId === i.productId && (p.variantId || null) === (i.variantId || null)));
  const anyTierAvailable = items.some((i) => nextTierHint(i, i.quantity));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">Mon panier</h1>
        <span className="rounded-full bg-mist px-3 py-1 text-sm font-semibold text-ink/60">{items.length} article{items.length > 1 ? 's' : ''}</span>
        {isWholesale && (
          <span className="badge bg-amber-100 text-amber-800">
            <BadgePercent size={13} /> Tarif pro -{customer.wholesaleDiscountPercent}%
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {items.map((item) => {
            const unitPrice = getUnitPriceForQuantity(item, item.quantity, customer, specialPrices);
            const key = lineKey(item);
            const isSpecial = specialPrices.some((p) => p.productId === item.productId && (p.variantId || null) === (item.variantId || null));
            const lineTotal = Math.round(unitPrice * item.quantity);
            const hint = nextTierHint(item, item.quantity);
            return (
              <div key={key} className="card p-4">
                <div className="flex gap-4">
                  <Link to={`/produits/${item.slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-mist">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-pine-700/30"><Fish size={28} strokeWidth={1.3} /></span>
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link to={`/produits/${item.slug}`} className="font-display font-semibold text-ink hover:text-brand-700">
                          {item.name}{item.variantLabel ? ` · ${item.variantLabel}` : ''}
                        </Link>
                        <p className="text-sm text-ink/50">
                          {item.variantId
                            ? `${formatQuantity(item.quantity, item.unit)} × ${formatFCFA(unitPrice)}`
                            : `${formatQuantity(item.quantity, item.unit)}${isWeight(item.unit) ? '' : ` ${UNIT_LABELS[item.unit] || ''}`} · ${formatFCFA(unitPrice)} / ${UNIT_LABELS[item.unit]}`}
                        </p>
                        {isSpecial && <p className="text-xs font-semibold text-amber-700">Votre prix négocié</p>}
                      </div>
                      <button
                        onClick={() => removeItem(key)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/40 transition hover:bg-red-50 hover:text-red-600"
                        aria-label={`Retirer ${item.name} du panier`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <QuantityStepper
                        value={item.quantity}
                        onChange={(q) => updateQuantity(key, q)}
                        min={item.minOrderQuantity}
                        max={item.stockAvailable}
                        step={isWeight(item.unit) ? 0.5 : 1}
                      />
                      <p className="font-display text-lg font-bold text-ink">{formatFCFA(lineTotal)}</p>
                    </div>
                  </div>
                </div>

                {hint && (
                  <p className="mt-3 rounded-lg bg-brand-500/10 px-3 py-2 text-xs font-medium text-brand-700">
                    Ajoutez {formatQuantity(hint.minQuantity - item.quantity, item.unit)}{isWeight(item.unit) ? '' : ` ${UNIT_LABELS[item.unit] || ''}`} pour passer à {formatFCFA(hint.unitPrice)} / {UNIT_LABELS[item.unit]}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-20">
          <div className="card p-5">
            <h2 className="font-display text-lg font-semibold">Récapitulatif</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-ink/60">
                <span>Sous-total</span>
                <span className="font-semibold text-ink">{formatFCFA(subtotalValue)}</span>
              </div>
              <div className="flex justify-between text-ink/60">
                <span className="flex items-center gap-1.5"><Truck size={14} /> Livraison</span>
                <span className="font-semibold text-ink">{formatFCFA(FLAT_DELIVERY_FEE)}</span>
              </div>
              <p className="-mt-1 text-xs text-ink/45">Tarif unique, quelle que soit la distance.</p>
              <div className="flex justify-between border-t border-line pt-3 font-display text-base font-bold text-ink">
                <span>Total</span>
                <span>{formatFCFA(subtotalValue + FLAT_DELIVERY_FEE)}</span>
              </div>
            </div>
            <button onClick={() => navigate('/checkout')} className="btn-primary mt-5 w-full">
              Passer la commande <ArrowRight size={17} />
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink/45">
              <Lock size={12} /> Paiement sécurisé · MTN MoMo ou Orange Money
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl2 bg-pine-900 px-4 py-3.5 text-white">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600">
              <BadgePercent size={19} />
            </span>
            <div>
              <p className="font-display text-sm font-semibold">{hasSpecialPrice ? 'Vos prix négociés sont appliqués.' : 'Plus vous achetez, moins vous payez !'}</p>
              <p className="text-xs text-white/60">
                {hasSpecialPrice
                  ? 'Le montant ne dépend pas de la quantité pour ces produits.'
                  : anyTierAvailable ? 'Augmentez une quantité pour débloquer un meilleur prix.' : 'Vous profitez déjà du meilleur prix par quantité.'}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
