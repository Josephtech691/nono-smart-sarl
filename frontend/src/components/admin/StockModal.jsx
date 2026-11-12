import { useEffect, useState } from 'react';
import { PackagePlus } from 'lucide-react';
import Modal from './Modal';
import { productsApi } from '../../api/catalog';
import { formatStock } from '../../utils/format';
import { activeVariants, availableStock, hasVariants, round2, variantAvailable } from '../../utils/products';

const MODES = [
  { value: 'delta', label: 'Entrée / sortie', hint: 'Quantité à ajouter (positive) ou à retirer (négative).' },
  { value: 'count', label: 'Inventaire', hint: 'Quantité réellement comptée : le stock est corrigé pour correspondre.' },
];

/**
 * Ajustement du stock d'un produit, tracé dans l'historique des mouvements :
 *  - « Entrée / sortie » : on saisit la quantité reçue (+) ou perdue / retirée (−) ;
 *  - « Inventaire »      : on saisit ce qu'on a compté, la différence est calculée.
 * `product` : produit à ajuster, ou null (fenêtre fermée). `onDone(produitMisÀJour)` après l'enregistrement.
 */
export default function StockModal({ product, onClose, onDone }) {
  const [variantId, setVariantId] = useState('');
  const [mode, setMode] = useState('delta');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setVariantId(product && hasVariants(product) ? activeVariants(product)[0]?.id || '' : '');
    setMode('delta');
    setValue('');
    setReason('');
    setBusy(false);
    setError('');
  }, [product]);

  if (!product) return null;

  // Produit à poids multiples : on ajuste le stock (en pièces) d'un poids à la fois.
  const variants = hasVariants(product) ? activeVariants(product) : null;
  const variant = variants ? variants.find((v) => v.id === variantId) || variants[0] : null;
  const source = variant || product;
  const unit = variant ? 'PIECE' : product.unit;
  const current = Number(source.stockQuantity) || 0;
  const reserved = Number(source.reservedQuantity) || 0;
  const entered = value.trim() === '' ? NaN : Number(value);
  const delta = Number.isFinite(entered) ? round2(mode === 'delta' ? entered : entered - current) : NaN;
  const next = Number.isFinite(delta) ? round2(current + delta) : NaN;

  let problem = '';
  if (Number.isFinite(entered)) {
    if (mode === 'count' && entered < 0) problem = 'La quantité comptée ne peut pas être négative.';
    else if (delta === 0) problem = mode === 'count' ? 'Le stock compté est identique au stock enregistré.' : 'Saisissez une quantité différente de zéro.';
    else if (next < 0) problem = `Le stock ne peut pas devenir négatif (il reste ${formatStock(current, unit)}).`;
  }
  const canSave = Number.isFinite(entered) && !problem && !busy;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError('');
    try {
      const body = { quantity: delta };
      if (variant) body.variantId = variant.id;
      const text = reason.trim() || (mode === 'count' ? 'Inventaire' : '');
      if (text) body.reason = text;
      const updated = await productsApi.adjustStock(product.id, body);
      onDone(updated, delta, variant);
    } catch (err) {
      setError(err.message || 'Ajustement impossible, réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const hint = MODES.find((m) => m.value === mode).hint;

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      icon={PackagePlus}
      title="Ajuster le stock"
      description={`${product.name}${variant ? ` (${variant.label})` : ''} : ${formatStock(current, unit)} en stock, ${formatStock(variant ? variantAvailable(variant) : availableStock(product), unit)} disponibles${reserved > 0 ? ` (${formatStock(reserved, unit)} réservés)` : ''}.`}
    >
      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        {variants && (
          <div>
            <label htmlFor="stock-variant" className="label">Poids à ajuster</label>
            <select id="stock-variant" className="input" value={variant?.id || ''} onChange={(e) => { setVariantId(e.target.value); setValue(''); setError(''); }}>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>{v.label} — {variantAvailable(v)} disponibles</option>
              ))}
            </select>
          </div>
        )}
        <div role="group" aria-label="Type d’ajustement" className="grid grid-cols-2 gap-2 rounded-xl2 bg-mist p-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              data-mode={m.value}
              onClick={() => {
                setMode(m.value);
                setValue('');
                setError('');
              }}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${mode === m.value ? 'bg-white text-ink shadow-sm' : 'text-ink/60 hover:text-ink'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="stock-value" className="label">
            {mode === 'delta' ? 'Quantité à ajouter ou retirer' : 'Quantité comptée'}
          </label>
          <input
            id="stock-value"
            type="number"
            inputMode="decimal"
            step="any"
            className="input"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError('');
            }}
            placeholder={mode === 'delta' ? 'ex. 25 ou -3' : `ex. ${Math.round(current)}`}
            data-autofocus
          />
          <p className="mt-1 text-xs text-ink/50">{hint}</p>
        </div>

        <div>
          <label htmlFor="stock-reason" className="label">
            Motif (facultatif)
          </label>
          <input id="stock-reason" className="input" list="stock-reasons" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={80} placeholder="Arrivage, perte, inventaire…" />
          <datalist id="stock-reasons">
            <option value="Arrivage" />
            <option value="Pêche du jour" />
            <option value="Perte / mortalité" />
            <option value="Retour client" />
            <option value="Inventaire" />
          </datalist>
        </div>

        {problem ? (
          <p role="alert" data-testid="stock-problem" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {problem}
          </p>
        ) : (
          Number.isFinite(next) && (
            <div data-testid="stock-preview" className="rounded-xl2 bg-brand-500/10 px-3 py-2.5 text-sm text-ink">
              <p>
                Nouveau stock : <strong>{formatStock(next, unit)}</strong>
                <span className="text-ink/60">
                  {' '}
                  ({delta > 0 ? '+' : ''}
                  {String(delta).replace('.', ',')})
                </span>
              </p>
              {next < reserved && <p className="mt-1 text-xs font-medium text-amber-800">Attention : {formatStock(reserved, unit)} sont réservés par des commandes en cours.</p>}
            </div>
          )
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary !py-3">
            Annuler
          </button>
          <button type="submit" disabled={!canSave} className="btn-primary !py-3" data-testid="stock-save">
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
