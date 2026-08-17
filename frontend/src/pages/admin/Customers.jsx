import { useEffect, useState } from 'react';
import { Search, BadgeCheck, Clock, Building2 } from 'lucide-react';
import { customersApi } from '../../api/customers';
import { RowSkeleton } from '../../components/Skeleton';
import { toast } from '../../store/toastStore';
import { formatDate, PROFESSIONAL_STATUS_LABELS } from '../../utils/format';

const STATUS_STYLES = {
  NONE: 'bg-mist text-ink/50',
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-brand-500/15 text-brand-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export default function AdminCustomers() {
  const [customers, setCustomers] = useState(null);
  const [search, setSearch] = useState('');
  const [reviewing, setReviewing] = useState(null);
  const [discount, setDiscount] = useState('5');

  const load = () => customersApi.list({ search: search || undefined, limit: 50 }).then((r) => setCustomers(r.items));

  useEffect(() => { load(); }, []);

  const decide = async (status) => {
    await customersApi.updateProfessionalStatus(reviewing.id, { status, wholesaleDiscountPercent: Number(discount) || 0 });
    toast.success(status === 'APPROVED' ? 'Compte professionnel approuvé' : 'Demande refusée');
    setReviewing(null);
    load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Clients</h1>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5">
          <Search size={15} className="text-ink/40" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, téléphone, email" className="w-56 border-0 bg-transparent text-sm focus:outline-none" />
        </form>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl2 border border-line bg-white">
        {customers === null ? (
          <div className="p-4"><RowSkeleton /></div>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Commandes</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Inscrit le</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-ink">
                    {c.user.firstName} {c.user.lastName}
                    {c.businessName && <span className="ml-1.5 text-xs text-ink/40">({c.businessName})</span>}
                  </td>
                  <td className="px-4 py-3 text-ink/60">{c.user.phone}</td>
                  <td className="px-4 py-3 text-ink/60">{c._count?.orders ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_STYLES[c.professionalStatus]}`}>{PROFESSIONAL_STATUS_LABELS[c.professionalStatus]}</span>
                  </td>
                  <td className="px-4 py-3 text-ink/50">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {c.professionalStatus === 'PENDING' && (
                      <button onClick={() => { setReviewing(c); setDiscount('5'); }} className="text-xs font-semibold text-brand-700 hover:underline">
                        Examiner
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-ink/40">Aucun client trouvé</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl2 bg-white p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700"><Building2 size={18} /></span>
              <div>
                <p className="font-display font-semibold text-ink">{reviewing.businessName || `${reviewing.user.firstName} ${reviewing.user.lastName}`}</p>
                <p className="text-xs text-ink/50">{reviewing.user.phone} {reviewing.taxId && `· ${reviewing.taxId}`}</p>
              </div>
            </div>
            <div className="mt-4">
              <label className="label">Remise grossiste à appliquer (%)</label>
              <input type="number" min="0" max="50" className="input" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => decide('REJECTED')} className="btn-secondary flex-1 !border-red-300 !text-red-600 hover:!bg-red-50">Refuser</button>
              <button onClick={() => decide('APPROVED')} className="btn-primary flex-1"><BadgeCheck size={16} /> Approuver</button>
            </div>
            <button onClick={() => setReviewing(null)} className="mt-3 w-full text-center text-xs text-ink/40 hover:underline">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
