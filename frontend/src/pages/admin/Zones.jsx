import { useEffect, useState } from 'react';
import { Plus, Pencil, EyeOff } from 'lucide-react';
import { zonesApi } from '../../api/logistics';
import Loader from '../../components/Loader';
import { formatFCFA } from '../../utils/format';
import usePageMeta from '../../utils/usePageMeta';

export default function AdminZones() {
  usePageMeta('Zones de livraison');
  const [zones, setZones] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', fee: '' });

  const load = () => zonesApi.list({ all: 'true' }).then(setZones);

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ name: '', fee: '' }); setEditing({}); };
  const openEdit = (z) => { setForm({ name: z.name, fee: z.fee }); setEditing(z); };

  const save = async (e) => {
    e.preventDefault();
    const payload = { name: form.name, fee: Number(form.fee) };
    if (editing?.id) await zonesApi.update(editing.id, payload);
    else await zonesApi.create(payload);
    setEditing(null);
    load();
  };

  const toggleActive = async (z) => {
    if (z.isActive) await zonesApi.remove(z.id);
    else await zonesApi.update(z.id, { isActive: true });
    load();
  };

  if (zones === null) return <Loader />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Zones de livraison</h1>
        <button onClick={openNew} className="btn-primary !py-2 text-sm"><Plus size={16} /> Nouvelle zone</button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {zones.map((z) => (
          <div key={z.id} className="card flex items-center justify-between p-4">
            <div>
              <p className="font-semibold text-ink">{z.name} {!z.isActive && <span className="badge ml-1 bg-mist text-ink/50">Inactive</span>}</p>
              <p className="text-sm text-ink/60">{formatFCFA(z.fee)}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => openEdit(z)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink/50 hover:bg-mist"><Pencil size={15} /></button>
              <button onClick={() => toggleActive(z)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink/50 hover:bg-mist"><EyeOff size={15} /></button>
            </div>
          </div>
        ))}
      </div>

      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={save} className="w-full max-w-sm space-y-4 rounded-xl2 bg-white p-6">
            <h2 className="font-display text-lg font-semibold">{editing.id ? 'Modifier' : 'Nouvelle zone'}</h2>
            <div>
              <label className="label">Nom du quartier</label>
              <input className="input" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Frais de livraison (FCFA)</label>
              <input type="number" className="input" required value={form.fee} onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))} />
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
