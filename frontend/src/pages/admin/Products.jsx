import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, PackagePlus } from 'lucide-react';
import { productsApi, categoriesApi } from '../../api/catalog';
import Loader from '../../components/Loader';
import { toast } from '../../store/toastStore';
import { formatFCFA, UNIT_LABELS } from '../../utils/format';

const UNIT_OPTIONS = Object.entries(UNIT_LABELS);

const EMPTY_FORM = {
  name: '', description: '', price: '', costPrice: '', unit: 'KILOGRAM', categoryId: '',
  stockQuantity: '', alertThreshold: '', minOrderQuantity: '1',
  isActive: true, isFeatured: false, images: '', priceTiers: [],
};

export default function AdminProducts() {
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = editing
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => productsApi.list({ all: 'true', limit: 100 }).then((r) => setProducts(r.items));

  useEffect(() => {
    load();
    categoriesApi.list({ all: 'true' }).then(setCategories);
  }, []);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditing({});
  };

  const openEdit = (p) => {
    setForm({
      name: p.name,
      description: p.description || '',
      price: p.price,
      costPrice: p.costPrice || '',
      unit: p.unit,
      categoryId: p.categoryId,
      stockQuantity: p.stockQuantity,
      alertThreshold: p.alertThreshold,
      minOrderQuantity: p.minOrderQuantity,
      isActive: p.isActive,
      isFeatured: p.isFeatured,
      images: (p.images || []).map((i) => i.url).join(', '),
      priceTiers: (p.priceTiers || []).map((t) => ({ minQuantity: t.minQuantity, unitPrice: t.unitPrice })),
    });
    setEditing(p);
  };

  const addTier = () => setForm((f) => ({ ...f, priceTiers: [...f.priceTiers, { minQuantity: '', unitPrice: '' }] }));
  const updateTier = (i, field, value) =>
    setForm((f) => ({ ...f, priceTiers: f.priceTiers.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)) }));
  const removeTier = (i) => setForm((f) => ({ ...f, priceTiers: f.priceTiers.filter((_, idx) => idx !== i) }));

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        price: Number(form.price),
        costPrice: Number(form.costPrice) || 0,
        unit: form.unit,
        categoryId: form.categoryId,
        stockQuantity: Number(form.stockQuantity) || 0,
        alertThreshold: Number(form.alertThreshold) || 0,
        minOrderQuantity: Number(form.minOrderQuantity) || 1,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        images: form.images.split(',').map((s) => s.trim()).filter(Boolean),
        priceTiers: form.priceTiers
          .filter((t) => t.minQuantity !== '' && t.unitPrice !== '')
          .map((t) => ({ minQuantity: Number(t.minQuantity), unitPrice: Number(t.unitPrice) })),
      };
      if (editing?.id) await productsApi.update(editing.id, payload);
      else await productsApi.create(payload);
      toast.success(editing?.id ? 'Produit mis à jour' : 'Produit créé');
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Désactiver ce produit ?')) return;
    await productsApi.remove(id);
    load();
  };

  const quickStock = async (id) => {
    const qty = prompt('Quantité à ajouter (négatif pour retirer) :');
    if (!qty || Number.isNaN(Number(qty))) return;
    await productsApi.adjustStock(id, { quantity: Number(qty), reason: 'Ajustement manuel (dashboard)' });
    toast.success('Stock mis à jour');
    load();
  };

  if (products === null) return <Loader />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Produits</h1>
        <button onClick={openNew} className="btn-primary !py-2 text-sm"><Plus size={16} /> Nouveau produit</button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl2 border border-line bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Prix</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((p) => {
              const available = p.stockQuantity - p.reservedQuantity;
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium text-ink">{p.name}</td>
                  <td className="px-4 py-3 text-ink/60">{p.category?.name}</td>
                  <td className="px-4 py-3 text-ink/60">{formatFCFA(p.price)} / {UNIT_LABELS[p.unit]}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => quickStock(p.id)} className="text-ink/60 underline decoration-dotted hover:text-brand-700">
                      {available} disp.
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${p.isActive ? 'bg-brand-500/15 text-brand-700' : 'bg-mist text-ink/50'}`}>
                      {p.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink/50 hover:bg-mist"><Pencil size={15} /></button>
                      <button onClick={() => remove(p.id)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink/50 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl2 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{editing.id ? 'Modifier le produit' : 'Nouveau produit'}</h2>
              <button onClick={() => setEditing(null)}><X size={20} /></button>
            </div>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="label">Nom</label>
                <input className="input" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Catégorie</label>
                  <select className="input" required value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
                    <option value="">Choisir...</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Unité</label>
                  <select className="input" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>
                    {UNIT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Prix de vente (FCFA)</label>
                  <input type="number" className="input" required value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Prix d'achat / coût (FCFA)</label>
                  <input type="number" className="input" value={form.costPrice} onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))} />
                  <p className="mt-1 text-[11px] text-ink/40">Utilisé pour calculer la marge (Statistiques avancées)</p>
                </div>
                <div>
                  <label className="label">Stock</label>
                  <input type="number" step="0.01" className="input" value={form.stockQuantity} onChange={(e) => setForm((f) => ({ ...f, stockQuantity: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Qté min. commande</label>
                  <input type="number" step="0.01" className="input" value={form.minOrderQuantity} onChange={(e) => setForm((f) => ({ ...f, minOrderQuantity: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Seuil d'alerte stock</label>
                  <input type="number" step="0.01" className="input" value={form.alertThreshold} onChange={(e) => setForm((f) => ({ ...f, alertThreshold: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Images (URLs séparées par une virgule)</label>
                <input className="input" value={form.images} onChange={(e) => setForm((f) => ({ ...f, images: e.target.value }))} placeholder="/products/silure-frais.jpg" />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="label !mb-0">Paliers de prix dégressif</label>
                  <button type="button" onClick={addTier} className="text-xs font-semibold text-brand-700 hover:underline">+ ajouter un palier</button>
                </div>
                <div className="space-y-2">
                  {form.priceTiers.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="number" step="0.01" placeholder="Quantité min." className="input" value={t.minQuantity} onChange={(e) => updateTier(i, 'minQuantity', e.target.value)} />
                      <input type="number" placeholder="Prix unitaire" className="input" value={t.unitPrice} onChange={(e) => updateTier(i, 'unitPrice', e.target.value)} />
                      <button type="button" onClick={() => removeTier(i)} className="shrink-0 text-ink/40 hover:text-red-600"><X size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-5">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} /> Actif</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))} /> Mis en avant</label>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={saving} className="btn-primary w-full">
                <PackagePlus size={17} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
