import { Satellite, LocateOff } from 'lucide-react';
import { useDriverStore } from '../../store/driverStore';

const VARIANTS = {
  sharing: {
    tone: 'border-brand-500/30 bg-brand-500/10 text-brand-700',
    icon: Satellite,
    text: 'Position partagée en direct avec le client',
  },
  waiting: {
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: Satellite,
    text: "En attente du signal GPS de l'appareil…",
  },
  denied: {
    tone: 'border-red-200 bg-red-50 text-red-700',
    icon: LocateOff,
    text: 'Localisation refusée : le client ne peut pas vous suivre. Autorisez-la dans les réglages du navigateur.',
  },
  unsupported: {
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: LocateOff,
    text: 'Ce navigateur ne permet pas de partager la position.',
  },
};

/** Bannière d'état du partage de position (visible tant qu'une livraison est en cours). */
export default function GpsBanner() {
  const gps = useDriverStore((s) => s.gps);
  const variant = VARIANTS[gps];
  if (!variant) return null;
  const Icon = variant.icon;
  return (
    <p role="status" data-testid="gps-banner" data-gps={gps} className={`mb-4 flex items-start gap-2 rounded-xl2 border px-3 py-2 text-xs font-medium ${variant.tone}`}>
      <Icon size={14} className="mt-0.5 shrink-0" /> <span>{variant.text}</span>
    </p>
  );
}
