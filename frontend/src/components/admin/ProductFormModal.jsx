import { useEffect, useRef, useState } from 'react';
import { Fish, PackagePlus, Plus, X } from 'lucide-react';
import Modal from './Modal';
import { productsApi } from '../../api/catalog';
import { formatStock, UNIT_LABELS } from '../../utils/format';

const UNIT_OPTIONS = Object.entries(UNIT_LABELS);

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '',
  costPrice: '',
  unit: 'KILOGRAM',
  categoryId: '',
  stockQuantity: '',
  alertThreshold: '',
  minOrderQuantity: '1',
  isActive: true,
  isFeatured: false,
  images: '',
  priceTiers: [],
  variants: [],
};

const EMPTY_VARIANT = { label: '', price: '', stockQuantity: '', imageUrl: '', isActive: true };
// Poids proposés en saisie rapide (modifiables à la main).
const WEIGHT_SUGGESTIONS = ['200 g', '300 g', '400 g', '500 g', '600 g', '700 g', '800 g', '1 kg', '1,5 kg', '2 kg'];

// Mêmes adresses d'image que le serveur : https://… ou un chemin du site (/products/silure-1.jpg).
const isImageUrl = (value) => /^https?:\/\/\S+$/i.test(value) || /^\/(?!\/)\S*$/.test(value);

const FIELD_LABELS = {
  name: 'Nom',
  description: 'Description',
  price: 'Prix de vente',
  costPrice: "Prix d'achat",
  unit: 'Unité',
  categoryId: 'Catégorie',
  stockQuantity: 'Stock',
  alertThreshold: "Seuil d'alerte",
  minOrderQuantity: 'Quantité minimale',
  images: 'Images',
  priceTiers: 'Paliers de prix',
  variants: 'Poids (variantes)',
};

const fromProduct = (p) => ({
  name: p.name,
  description: p.description || '',
  price: p.price,
  costPrice: p.costPrice || '',
  unit: p.unit,
  categoryId: p.categoryId,
  stockQuantity: p.stockQuantity,
  alertThreshold: p.alertThreshold || '',
  minOrderQuantity: p.minOrderQuantity,
  isActive: p.isActive,
  isFeatured: p.isFeatured,
  images: (p.images || []).map((i) => i.url).join(', '),
  priceTiers: (p.priceTiers || []).map((t) => ({ minQuantity: t.minQuantity, unitPrice: t.unitPrice })),
  variants: (p.variants || []).map((v) => ({ id: v.id, label: v.label, price: v.price, stockQuantity: v.stockQuantity, imageUrl: v.imageUrl || '', isActive: v.isActive !== false })),
});

const splitImages = (text) => text.split(',').map((s) => s.trim()).filter(Boolean);
const isBlank = (v) => v === '' || v === null || v === undefined;

/** Liste des corrections à apporter avant l'envoi (vide = le formulaire est bon). */
export function validateProductForm(form, { editing }) {
  const problems = [];
  if (form.name.trim().length < 2) problems.push('Le nom doit contenir au moins 2 caractères.');
  if (!form.categoryId) problems.push('Choisissez une catégorie.');

  const hasVariants = form.variants.length > 0;
  const price = Number(form.price);
  // Avec des poids (variantes), le prix de chaque poids remplace le prix de vente du produit.
  if (!hasVariants && (isBlank(form.price) || !Number.isInteger(price) || price <= 0)) problems.push('Le prix de vente doit être un nombre entier de FCFA, supérieur à 0.');
  if (!isBlank(form.costPrice) && (!Number.isInteger(Number(form.costPrice)) || Number(form.costPrice) < 0)) problems.push("Le prix d'achat doit être un nombre entier de FCFA (0 ou plus).");
  if (!editing && !isBlank(form.stockQuantity) && !(Number(form.stockQuantity) >= 0)) problems.push('Le stock de départ ne peut pas être négatif.');
  if (!isBlank(form.alertThreshold) && !(Number(form.alertThreshold) >= 0)) problems.push("Le seuil d'alerte ne peut pas être négatif.");
  if (!isBlank(form.minOrderQuantity) && !(Number(form.minOrderQuantity) > 0)) problems.push('La quantité minimale de commande doit être supérieure à 0.');

  splitImages(form.images).forEach((url, i) => {
    if (!isImageUrl(url)) problems.push(`Image ${i + 1} : adresse invalide (https://… ou /dossier/image.jpg).`);
  });

  const seen = new Set();
  form.variants.forEach((v, i) => {
    const name = `Poids ${i + 1}`;
    if (!String(v.label).trim()) problems.push(`${name} : indiquez le poids (ex. 300 g).`);
    else if (seen.has(String(v.label).trim().toLowerCase())) problems.push(`${name} : « ${String(v.label).trim()} » existe déjà.`);
    seen.add(String(v.label).trim().toLowerCase());
    if (isBlank(v.price) || !Number.isInteger(Number(v.price)) || Number(v.price) <= 0) problems.push(`${name} : le prix d'une pièce doit être un nombre entier de FCFA, supérieur à 0.`);
    if (!isBlank(v.stockQuantity) && (!Number.isInteger(Number(v.stockQuantity)) || Number(v.stockQuantity) < 0)) problems.push(`${name} : le stock est un nombre entier de pièces (0 ou plus).`);
    if (!isBlank(v.imageUrl) && !isImageUrl(String(v.imageUrl).trim())) problems.push(`${name} : adresse de photo invalide (https://… ou /dossier/image.jpg).`);
  });

  if (!hasVariants) form.priceTiers.forEach((tier, i) => {
    const noQty = isBlank(tier.minQuantity);
    const noPrice = isBlank(tier.unitPrice);
    if (noQty && noPrice) return; // ligne vide : ignorée
    if (noQty || noPrice) problems.push(`Palier ${i + 1} : renseignez la quantité minimale et le prix unitaire.`);
    else if (!(Number(tier.minQuantity) > 0) || !Number.isInteger(Number(tier.unitPrice)) || Number(tier.unitPrice) <= 0) {
      problems.push(`Palier ${i + 1} : quantité supérieure à 0 et prix unitaire entier supérieur à 0.`);
    }
  });
  return problems;
}

// Le serveur refuse des champs que la vérification locale laisse passer : on les nomme (ses messages sont en anglais).
function describeServerError(err) {
  if (Array.isArray(err.details) && err.details.length) {
    const labels = [...new Set(err.details.map((d) => FIELD_LABELS[String(d.field || '').split('.')[0]]).filter(Boolean))];
    if (labels.length) return [`Le serveur a refusé : ${labels.join(', ')}. Vérifiez ces champs.`];
  }
  return [err.message || 'Enregistrement impossible, réessayez.'];
}

function Field({ id, label, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink/50">{hint}</p>}
    </div>
  );
}

/**
 * Création et modification d'un produit.
 * `product` : produit à modifier, ou null pour un nouveau. `onSaved(produit, estNouveau)` après l'enregistrement.
 * À la modification, le stock n'est plus saisi ici (« Ajuster le stock » le trace dans l'historique et évite
 * d'écraser un stock qui a changé entre-temps avec une commande).
 */
export default function ProductFormModal({ open, product, categories, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [problems, setProblems] = useState([]);
  const [busy, setBusy] = useState(false);
  const problemsRef = useRef(null);
  const editing = Boolean(product?.id);

  useEffect(() => {
    if (!open) return;
    setForm(product ? fromProduct(product) : EMPTY_FORM);
    setProblems([]);
    setBusy(false);
  }, [open, product]);

  useEffect(() => {
    if (problems.length) problemsRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [problems]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggle = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }));
  const addTier = () => setForm((f) => ({ ...f, priceTiers: [...f.priceTiers, { minQuantity: '', unitPrice: '' }] }));
  const updateTier = (i, field, value) => setForm((f) => ({ ...f, priceTiers: f.priceTiers.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)) }));
  const addVariant = (label = '') => setForm((f) => ({ ...f, variants: [...f.variants, { ...EMPTY_VARIANT, label }] }));
  const updateVariant = (i, field, value) => setForm((f) => ({ ...f, variants: f.variants.map((v, idx) => (idx === i ? { ...v, [field]: value } : v)) }));
  const removeVariant = (i) => setForm((f) => ({ ...f, variants: f.variants.filter((_, idx) => idx !== i) }));
  const removeTier = (i) => setForm((f) => ({ ...f, priceTiers: f.priceTiers.filter((_, idx) => idx !== i) }));

  const submit = async (e) => {
    e.preventDefault();
    const found = validateProductForm(form, { editing });
    setProblems(found);
    if (found.length) return;

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      costPrice: Number(form.costPrice) || 0,
      unit: form.unit,
      categoryId: form.categoryId,
      alertThreshold: Number(form.alertThreshold) || 0,
      minOrderQuantity: Number(form.minOrderQuantity) || 1,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      images: splitImages(form.images),
      priceTiers: form.variants.length
        ? []
        : form.priceTiers
            .filter((t) => !isBlank(t.minQuantity) && !isBlank(t.unitPrice))
            .map((t) => ({ minQuantity: Number(t.minQuantity), unitPrice: Number(t.unitPrice) })),
      // Poids du produit : chacun avec son prix par pièce, son stock et sa photo. Liste vide = produit simple.
      variants: form.variants.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        label: String(v.label).trim(),
        price: Number(v.price),
        stockQuantity: Number(v.stockQuantity) || 0,
        imageUrl: String(v.imageUrl).trim(),
        isActive: v.isActive,
      })),
    };
    // Sans variantes : prix de vente et stock du produit. Avec variantes : le prix « à partir de » est le plus bas prix de poids.
    if (!form.variants.length) payload.price = Number(form.price);
    if (!editing && !form.variants.length) payload.stockQuantity = Number(form.stockQuantity) || 0;

    setBusy(true);
    try {
      const saved = editing ? await productsApi.update(product.id, payload) : await productsApi.create(payload);
      onSaved(saved, !editing);
    } catch (err) {
      setProblems(describeServerError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} busy={busy} size="lg" icon={PackagePlus} title={editing ? 'Modifier le produit' : 'Nouveau produit'}>
      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <Field id="product-name" label="Nom">
          <input id="product-name" className="input" value={form.name} onChange={set('name')} autoComplete="off" />
        </Field>
        <Field id="product-description" label="Description">
          <textarea id="product-description" className="input" rows={2} value={form.description} onChange={set('description')} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="product-category" label="Catégorie">
            <select id="product-category" className="input" value={form.categoryId} onChange={set('categoryId')}>
              <option value="">Choisir…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="product-unit" label="Unité">
            <select id="product-unit" className="input" value={form.unit} onChange={set('unit')}>
              {UNIT_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {form.variants.length > 0 && (
          <p className="rounded-lg bg-brand-500/10 px-3 py-2 text-xs text-brand-800">
            Ce produit a plusieurs poids : le prix et le stock se règlent poids par poids, plus bas. Le prix affiché « à partir de » est le plus bas prix.
          </p>
        )}

        <div className={`grid gap-3 sm:grid-cols-3 ${form.variants.length > 0 ? 'hidden' : ''}`}>
          <Field id="product-price" label="Prix de vente (FCFA)">
            <input id="product-price" type="number" inputMode="numeric" min="1" step="1" className="input" value={form.price} onChange={set('price')} />
          </Field>
          <Field id="product-cost" label="Prix d'achat (FCFA)" hint="Sert à calculer la marge dans les statistiques.">
            <input id="product-cost" type="number" inputMode="numeric" min="0" step="1" className="input" value={form.costPrice} onChange={set('costPrice')} />
          </Field>
          {editing ? (
            <Field id="product-stock" label="Stock" hint="Modifiez-le avec « Ajuster le stock » dans la liste.">
              <input id="product-stock" className="input bg-mist text-ink/60" value={formatStock(form.stockQuantity, form.unit)} readOnly disabled />
            </Field>
          ) : (
            <Field id="product-stock" label="Stock de départ">
              <input id="product-stock" type="number" inputMode="decimal" min="0" step="any" className="input" value={form.stockQuantity} onChange={set('stockQuantity')} />
            </Field>
          )}
        </div>

        <div className={`grid gap-3 sm:grid-cols-2 ${form.variants.length > 0 ? 'hidden' : ''}`}>
          <Field id="product-min" label="Quantité minimale de commande">
            <input id="product-min" type="number" inputMode="decimal" min="0" step="any" className="input" value={form.minOrderQuantity} onChange={set('minOrderQuantity')} />
          </Field>
          <Field id="product-alert" label="Seuil d'alerte stock" hint="Alerte quand le disponible descend à ce niveau (0 = pas d'alerte).">
            <input id="product-alert" type="number" inputMode="decimal" min="0" step="any" className="input" value={form.alertThreshold} onChange={set('alertThreshold')} />
          </Field>
        </div>

        <Field id="product-images" label="Images (adresses séparées par une virgule)" hint="La première est la photo principale.">
          <input id="product-images" className="input" value={form.images} onChange={set('images')} placeholder="/products/silure-1.jpg, https://…" spellCheck={false} />
        </Field>

        {/* Poids (variantes) : « d'autres produits dans un seul produit », chacun avec sa photo. */}
        <div className="rounded-xl2 border border-line p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="label !mb-0">Poids / variantes (facultatif)</p>
              <p className="text-[11px] text-ink/50">Ex. silure : 200 g, 300 g … 1 kg. Chaque poids a sa photo, son prix par pièce et son stock ; le client choisit le nombre de pièces de chaque poids.</p>
            </div>
            <button type="button" onClick={() => addVariant()} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-700 hover:underline" data-testid="add-variant">
              <Plus size={14} aria-hidden="true" /> Ajouter un poids
            </button>
          </div>

          <datalist id="weight-suggestions">
            {WEIGHT_SUGGESTIONS.map((w) => <option key={w} value={w} />)}
          </datalist>

          {form.variants.length === 0 ? (
            <p className="text-xs text-ink/50">Aucun poids : le produit se vend avec un seul prix (et les paliers dégressifs ci-dessous).</p>
          ) : (
            <ul className="space-y-3">
              {form.variants.map((v, i) => (
                <li key={v.id || i} className={`rounded-xl border border-line p-3 ${v.isActive ? '' : 'bg-mist/60'}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-mist text-ink/30" aria-hidden="true">
                      {v.imageUrl && isImageUrl(String(v.imageUrl).trim()) ? <img src={String(v.imageUrl).trim()} alt="" className="h-full w-full object-cover" /> : <Fish size={22} strokeWidth={1.3} />}
                    </span>
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                      <input list="weight-suggestions" aria-label={`Poids ${i + 1} : nom`} placeholder="Poids (ex. 300 g)" className="input col-span-2 !py-2" value={v.label} onChange={(e) => updateVariant(i, 'label', e.target.value)} />
                      <input type="number" inputMode="numeric" min="1" step="1" aria-label={`Poids ${i + 1} : prix d'une pièce`} placeholder="Prix / pièce" className="input !py-2" value={v.price} onChange={(e) => updateVariant(i, 'price', e.target.value)} />
                      <input type="number" inputMode="numeric" min="0" step="1" aria-label={`Poids ${i + 1} : stock en pièces`} placeholder="Stock (pièces)" className="input !py-2" value={v.stockQuantity} onChange={(e) => updateVariant(i, 'stockQuantity', e.target.value)} />
                    </div>
                    <button type="button" onClick={() => removeVariant(i)} aria-label={`Supprimer le poids ${i + 1}`} className="shrink-0 rounded-full p-1.5 text-ink/40 hover:bg-red-50 hover:text-red-600">
                      <X size={16} />
                    </button>
                  </div>
                  <input aria-label={`Poids ${i + 1} : adresse de la photo`} placeholder="Photo : /products/silure-300g.jpg ou https://…" spellCheck={false} className="input mt-2 !py-2 text-sm" value={v.imageUrl} onChange={(e) => updateVariant(i, 'imageUrl', e.target.value)} />
                  <label className="mt-2 flex items-center gap-2 text-xs text-ink/70">
                    <input type="checkbox" checked={v.isActive} onChange={(e) => updateVariant(i, 'isActive', e.target.checked)} /> Visible dans la boutique
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={form.variants.length > 0 ? 'hidden' : ''}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="label !mb-0">Paliers de prix dégressif</p>
            <button type="button" onClick={addTier} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline" data-testid="add-tier">
              <Plus size={14} aria-hidden="true" /> Ajouter un palier
            </button>
          </div>
          {form.priceTiers.length === 0 ? (
            <p className="text-xs text-ink/50">Aucun palier : le prix de vente s’applique quelle que soit la quantité.</p>
          ) : (
            <div className="space-y-2">
              {form.priceTiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="number" inputMode="decimal" min="0" step="any" aria-label={`Palier ${i + 1} : quantité minimale`} placeholder="Quantité min." className="input" value={t.minQuantity} onChange={(e) => updateTier(i, 'minQuantity', e.target.value)} />
                  <input type="number" inputMode="numeric" min="1" step="1" aria-label={`Palier ${i + 1} : prix unitaire`} placeholder="Prix unitaire" className="input" value={t.unitPrice} onChange={(e) => updateTier(i, 'unitPrice', e.target.value)} />
                  <button type="button" onClick={() => removeTier(i)} aria-label={`Supprimer le palier ${i + 1}`} className="shrink-0 rounded-full p-1.5 text-ink/40 hover:bg-red-50 hover:text-red-600">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={toggle('isActive')} /> Visible dans la boutique
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isFeatured} onChange={toggle('isFeatured')} /> Mis en avant
          </label>
        </div>

        {problems.length > 0 && (
          <div ref={problemsRef} role="alert" data-testid="product-problems" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {problems.length === 1 ? (
              <p>{problems[0]}</p>
            ) : (
              <ul className="list-disc space-y-0.5 pl-5">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary !py-3">
            Annuler
          </button>
          <button type="submit" disabled={busy} className="btn-primary !py-3" data-testid="product-save">
            <PackagePlus size={17} aria-hidden="true" /> {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
