import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { couponsApi } from '../../api/extras';
import Loader from '../../components/Loader';
import { formatFCFA, formatDate } from '../../utils/format';
import usePageMeta from '../../utils/usePageMeta';

const EMPTY_FORM = { code: '', type: 'PERCENTAGE', value: '', minOrderAmount: '', expiresAt: '' };

export default function AdminCoupons() {
  usePageMeta('Promotions');
  const [coupons, setCoupons] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const load = () => couponsApi.list().then(setCoupons);

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await couponsApi.create({
        code: form.code,
        type: form.type,
        value: Number(form.value),
        minOrderAmount: Number(form.minOrderAmount) || 0,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleActive = async (c) => {
    await couponsApi.update(c.id, { isActive: !c.isActive });
    load();
  };

  if (coupons === null) return <Loader />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Codes promo</h1>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary !py-2 text-sm"><Plus size={16} /> Nouveau code</button>
      </div>

      {showForm && (
        <form onSubmit={save} className="card mt-4 grid gap-3 p-5 sm:grid-cols-2">
          <input className="input" placeholder="CODE (ex: PROMO10)" required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
          <select className="input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
            <option value="PERCENTAGE">Pourcentage (%)</option>
            <option value="FIXED">Montant fixe (FCFA)</option>
          </select>
          <input className="input" type="number" placeholder="Valeur" required value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
          <input className="input" type="number" placeholder="Montant minimum (FCFA)" value={form.minOrderAmount} onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))} />
          <input className="input" type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} />
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <button type="submit" className="btn-primary sm:col-span-2">Créer le code</button>
        </form>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {coupons.map((c) => (
          <div key={c.id} className="card p-4">
            <div className="flex items-center justify-between">
              <p className="font-display font-bold text-ink">{c.code}</p>
              <span className={`badge ${c.isActive ? 'bg-brand-500/15 text-brand-700' : 'bg-mist text-ink/50'}`}>{c.isActive ? 'Actif' : 'Inactif'}</span>
            </div>
            <p className="mt-1 text-sm text-ink/60">
              {c.type === 'PERCENTAGE' ? `${c.value}%` : formatFCFA(c.value)} de réduction
              {c.minOrderAmount > 0 && ` · dès ${formatFCFA(c.minOrderAmount)}`}
            </p>
            {c.expiresAt && <p className="text-xs text-ink/40">Valide jusqu'au {formatDate(c.expiresAt)}</p>}
            <p className="text-xs text-ink/40">{c.usageCount} utilisation(s)</p>
            <button onClick={() => toggleActive(c)} className="mt-2 text-xs font-medium text-brand-700 hover:underline">
              {c.isActive ? 'Désactiver' : 'Réactiver'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
