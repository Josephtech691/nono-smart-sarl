import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { expensesApi } from '../../api/extras';
import Loader from '../../components/Loader';
import { formatFCFA, formatDate } from '../../utils/format';
import usePageMeta from '../../utils/usePageMeta';

const CATEGORIES = [
  { value: 'achat_poisson', label: 'Achat des poissons' },
  { value: 'transport', label: 'Transport' },
  { value: 'carburant', label: 'Carburant' },
  { value: 'salaires', label: 'Salaires' },
  { value: 'emballages', label: 'Emballages' },
  { value: 'autre', label: 'Autre' },
];

const EMPTY_FORM = { category: 'achat_poisson', label: '', amount: '' };

export default function AdminFinances() {
  usePageMeta('Dépenses & bénéfices');
  const [expenses, setExpenses] = useState(null);
  const [profit, setProfit] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = () => {
    expensesApi.list().then(setExpenses);
    expensesApi.profitEstimate({}).then(setProfit);
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    await expensesApi.create({ ...form, amount: Number(form.amount) });
    setForm(EMPTY_FORM);
    load();
  };

  const remove = async (id) => {
    await expensesApi.remove(id);
    load();
  };

  if (expenses === null || profit === null) return <Loader />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Dépenses & bénéfices</h1>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-ink/50">Chiffre d'affaires</p><p className="font-display text-xl font-bold text-ink">{formatFCFA(profit.revenue)}</p></div>
        <div className="card p-4"><p className="text-xs text-ink/50">Coûts de livraison</p><p className="font-display text-xl font-bold text-ink">{formatFCFA(profit.deliveryCosts)}</p></div>
        <div className="card p-4"><p className="text-xs text-ink/50">Dépenses</p><p className="font-display text-xl font-bold text-ink">{formatFCFA(profit.totalExpenses)}</p></div>
        <div className="card bg-pine-900 p-4 text-white"><p className="text-xs text-white/60">Bénéfice estimé</p><p className="font-display text-xl font-bold">{formatFCFA(profit.estimatedProfit)}</p></div>
      </div>

      <form onSubmit={save} className="card mt-6 grid gap-3 p-5 sm:grid-cols-4">
        <select className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input className="input sm:col-span-2" placeholder="Libellé" required value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
        <input className="input" type="number" placeholder="Montant (FCFA)" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        <button type="submit" className="btn-primary sm:col-span-4"><Plus size={16} /> Ajouter la dépense</button>
      </form>

      <div className="mt-6 space-y-2">
        {expenses.map((e) => (
          <div key={e.id} className="card flex items-center justify-between p-3">
            <div>
              <p className="text-sm font-medium text-ink">{e.label}</p>
              <p className="text-xs text-ink/50">{CATEGORIES.find((c) => c.value === e.category)?.label || e.category} · {formatDate(e.incurredAt)}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-medium text-ink">{formatFCFA(e.amount)}</p>
              <button onClick={() => remove(e.id)} className="text-ink/40 hover:text-red-600"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
