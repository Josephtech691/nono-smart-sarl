import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { driversApi } from '../../api/logistics';
import { useAuthStore } from '../../store/authStore';
import { useDriverStore } from '../../store/driverStore';
import { toast } from '../../store/toastStore';

const OPTIONS = [
  { value: 'AVAILABLE', label: 'Disponible', dot: 'bg-brand-500' },
  { value: 'BUSY', label: 'Occupé', dot: 'bg-amber-500' },
  { value: 'OFFLINE', label: 'Hors ligne', dot: 'bg-ink/30' },
];

export const AVAILABILITY_LABELS = { AVAILABLE: 'Disponible', BUSY: 'Occupé', OFFLINE: 'Hors ligne', SUSPENDED: 'Suspendu' };

/** Le livreur indique s'il peut recevoir de nouvelles livraisons (l'attribution automatique ne choisit que les « disponibles »). */
export default function AvailabilityPicker() {
  const user = useAuthStore((s) => s.user);
  const summaryStatus = useDriverStore((s) => s.summary?.status);
  const setStatus = useDriverStore((s) => s.setStatus);
  const [busy, setBusy] = useState(false);
  const status = summaryStatus || user?.driverProfile?.status || 'OFFLINE';

  if (status === 'SUSPENDED') {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
        <ShieldAlert size={18} className="mt-0.5 shrink-0" />
        <span>Votre compte livreur est suspendu. Contactez l'administration pour le réactiver.</span>
      </p>
    );
  }

  const change = async (next) => {
    if (busy || next === status) return;
    const previous = status;
    setStatus(next);
    setBusy(true);
    try {
      await driversApi.updateMyStatus(next);
    } catch (err) {
      setStatus(previous);
      toast.error(err.message || 'Changement impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="radiogroup" aria-label="Ma disponibilité" className="grid grid-cols-3 gap-1.5 rounded-xl bg-mist p-1">
      {OPTIONS.map((o) => {
        const selected = o.value === status;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={busy}
            onClick={() => change(o.value)}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition ${
              selected ? 'bg-white text-ink shadow-sm' : 'text-ink/55 hover:text-ink'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${o.dot}`} aria-hidden="true" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
