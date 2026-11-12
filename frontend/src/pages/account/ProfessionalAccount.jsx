import { useState } from 'react';
import { Building2, BadgeCheck, Clock, XCircle } from 'lucide-react';
import { customersApi } from '../../api/customers';
import { useAuthStore } from '../../store/authStore';
import AccountBack from '../../components/AccountBack';
import { toast } from '../../store/toastStore';
import { PROFESSIONAL_STATUS_LABELS } from '../../utils/format';

const STATUS_UI = {
  NONE: { icon: Building2, className: 'text-ink/50' },
  PENDING: { icon: Clock, className: 'text-amber-600' },
  APPROVED: { icon: BadgeCheck, className: 'text-brand-600' },
  REJECTED: { icon: XCircle, className: 'text-red-600' },
};

export default function ProfessionalAccount() {
  const { user, hydrate } = useAuthStore();
  const status = user?.customerProfile?.professionalStatus || 'NONE';
  const [businessName, setBusinessName] = useState(user?.customerProfile?.businessName || '');
  const [taxId, setTaxId] = useState(user?.customerProfile?.taxId || '');
  const [submitting, setSubmitting] = useState(false);

  const { icon: StatusIcon, className } = STATUS_UI[status];

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await customersApi.requestProfessional({ businessName, taxId });
      await hydrate();
      toast.success('Demande envoyée — nous reviendrons vers vous rapidement');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Compte professionnel</h1>
      <AccountBack />

      <div className="card p-5">
        <div className="flex items-center gap-3">
          <span className={`flex h-11 w-11 items-center justify-center rounded-full bg-mist ${className}`}>
            <StatusIcon size={20} />
          </span>
          <div>
            <p className="font-display font-semibold text-ink">{PROFESSIONAL_STATUS_LABELS[status]}</p>
            {status === 'APPROVED' && (
              <p className="text-sm text-brand-700">Remise grossiste active : -{user.customerProfile.wholesaleDiscountPercent}% sur tous les produits</p>
            )}
          </div>
        </div>

        {status !== 'APPROVED' && (
          <form onSubmit={submit} className="mt-6 space-y-4 border-t border-line pt-5">
            <p className="text-sm text-ink/60">
              Restaurants, hôtels, poissonneries, pisciculteurs : demandez un tarif grossiste pour vos commandes régulières
              (sections 3.2 à 3.5 du cahier des charges).
            </p>
            <div>
              <label className="label">Nom de l'entreprise</label>
              <input className="input" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div>
              <label className="label">Numéro fiscal / registre de commerce (facultatif)</label>
              <input className="input" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Envoi...' : status === 'PENDING' ? 'Mettre à jour la demande' : 'Demander un compte professionnel'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
