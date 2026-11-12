import { useEffect, useState } from 'react';
import { BadgeDollarSign, Trash2 } from 'lucide-react';
import Modal from './Modal';
import { customersApi } from '../../api/customers';
import { productsApi } from '../../api/catalog';
import { toast } from '../../store/toastStore';
import { formatFCFA } from '../../utils/format';
import { activeVariants, hasVariants } from '../../utils/products';

/**
 * Prix négociés d'un client : l'administration fixe un prix (par kg, par pièce…) pour un produit ou un poids.
 * Ce prix s'applique à toutes les commandes de ce client, quelle que soit la quantité (il remplace les paliers).
 */
export default function CustomerPricesModal({ customer, name, onClose }) {
  const [prices, setPrices] = useState(null);
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!customer) return;
    setPrices(null); setProductId(''); setVariantId(''); setValue(''); setError('');
    customersApi.prices(customer.id).then(setPrices).catch(() => { setPrices([]); setError('Impossible de charger les prix de ce client.'); });
    (async () => {
      const all = [];
      for (let page = 1; page <= 10; page += 1) {
        const res = await productsApi.list({ all: 'true', limit: 100, page });
        all.push(...(res.items || []));
        if (all.length >= (res.total || 0)) break;
      }
      setProducts(all.filter((p) => p.isActive));
    })().catch(() => setError('Impossible de charger les produits.'));
  }, [customer]);

  const product = products.find((p) => p.id === productId);
  const variants = product && hasVariants(product) ? activeVariants(product) : null;

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const price = Number(value);
    if (!product) return setError('Choisissez un produit.');
    if (variants && !variantId) return setError('Choisissez le poids concerné.');
    if (!Number.isInteger(price) || price <= 0) return setError('Le prix doit être un nombre entier de FCFA, supérieur à 0.');
    setBusy(true);
    try {
      const saved = await customersApi.setPrice(customer.id, { productId, variantId: variants ? variantId : undefined, unitPrice: price });
      setPrices((list) => [saved, ...(list || []).filter((p) => p.id !== saved.id)]);
      setValue('');
      toast.success('Prix enregistré');
    } catch (err) {
      setError(err.response?.data?.message || 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p) => {
    setBusy(true);
    try {
      await customersApi.removePrice(customer.id, p.id);
      setPrices((list) => list.filter((x) => x.id !== p.id));
      toast.success('Prix supprimé : le client retrouve les prix normaux');
    } catch {
      toast.error('Suppression impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={Boolean(customer)} onClose={onClose} title="Prix négociés" icon={BadgeDollarSign} size="lg" busy={busy}
      description={`${name} : ces prix remplacent les prix normaux et dégressifs, quelle que soit la quantité commandée.`}>
      <form onSubmit={save} noValidate className="mt-4 space-y-3">
        <div>
          <label htmlFor="cp-product" className="label">Produit</label>
          <select id="cp-product" className="input" value={productId} onChange={(e) => { setProductId(e.target.value); setVariantId(''); }}>
            <option value="">— Choisir —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {variants && (
          <div>
            <label htmlFor="cp-variant" className="label">Poids</label>
            <select id="cp-variant" className="input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              <option value="">— Choisir —</option>
              {variants.map((v) => <option key={v.id} value={v.id}>{v.label} (normal : {formatFCFA(v.price)})</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="cp-price" className="label">Prix pour ce client (FCFA{variants ? ' / pièce' : ''})</label>
          <input id="cp-price" type="number" inputMode="numeric" min="1" step="1" className="input" value={value} onChange={(e) => setValue(e.target.value)} />
          {product && !variants && <p className="mt-1 text-xs text-ink/50">Prix normal : {formatFCFA(product.price)}</p>}
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">Enregistrer le prix</button>
      </form>

      <h3 className="mb-2 mt-6 font-display text-sm font-semibold">Prix déjà fixés</h3>
      {prices === null ? (
        <p className="text-sm text-ink/50">Chargement…</p>
      ) : prices.length === 0 ? (
        <p className="text-sm text-ink/50">Aucun prix négocié : ce client paie les prix normaux.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl2 border border-line">
          {prices.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{p.product.name}{p.variant ? ` · ${p.variant.label}` : ''}</p>
                <p className="text-xs text-ink/55">Normal : {formatFCFA(p.variant ? p.variant.price : p.product.price)}</p>
              </div>
              <p className="font-display font-bold text-brand-700">{formatFCFA(p.unitPrice)}</p>
              <button type="button" disabled={busy} onClick={() => remove(p)} aria-label={`Supprimer le prix de ${p.product.name}`} className="rounded-full p-2 text-ink/40 hover:bg-red-50 hover:text-red-600">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
