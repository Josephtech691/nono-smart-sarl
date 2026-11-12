import { useEffect, useState } from 'react';
import { Plus, Pencil, EyeOff } from 'lucide-react';
import { categoriesApi } from '../../api/catalog';
import Loader from '../../components/Loader';
import usePageMeta from '../../utils/usePageMeta';

export default function AdminCategories() {
  usePageMeta('Catégories');
  const [categories, setCategories] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const load = () => categoriesApi.list({ all: 'true' }).then(setCategories);

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ name: '', description: '' }); setEditing({}); };
  const openEdit = (c) => { setForm({ name: c.name, description: c.description || '' }); setEditing(c); };

  const save = async (e) => {
    e.preventDefault();
    if (editing?.id) await categoriesApi.update(editing.id, form);
    else await categoriesApi.create(form);
    setEditing(null);
    load();
  };

  const toggleActive = async (c) => {
    if (c.isActive) await categoriesApi.remove(c.id);
    else await categoriesApi.update(c.id, { isActive: true });
    load();
  };

  if (categories === null) return <Loader />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Catégories</h1>
        <button onClick={openNew} className="btn-primary !py-2 text-sm"><Plus size={16} /> Nouvelle catégorie</button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {categories.map((c) => (
          <div key={c.id} className="card flex items-center justify-between p-4">
            <div>
              <p className="font-semibold text-ink">{c.name} {!c.isActive && <span className="badge ml-1 bg-mist text-ink/50">Inactive</span>}</p>
              <p className="text-xs text-ink/50">{c._count?.products ?? 0} produit(s)</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => openEdit(c)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink/50 hover:bg-mist"><Pencil size={15} /></button>
              <button onClick={() => toggleActive(c)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink/50 hover:bg-mist"><EyeOff size={15} /></button>
            </div>
          </div>
        ))}
      </div>

      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={save} className="w-full max-w-sm space-y-4 rounded-xl2 bg-white p-6">
            <h2 className="font-display text-lg font-semibold">{editing.id ? 'Modifier' : 'Nouvelle catégorie'}</h2>
            <div>
              <label className="label">Nom</label>
              <input className="input" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-secondary flex-1">Annuler</button>
              <button type="submit" className="btn-primary flex-1">Enregistrer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
