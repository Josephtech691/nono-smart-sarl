import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Truck, PackageCheck, CheckCircle2, Banknote, PackageSearch } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useDriverStore } from '../../store/driverStore';
import AvailabilityPicker from '../../components/driver/AvailabilityPicker';
import DeliveryCard from '../../components/driver/DeliveryCard';
import EmptyState from '../../components/EmptyState';
import usePageMeta from '../../utils/usePageMeta';
import { deliveryGroup, initialsOf, pickNextDelivery } from '../../utils/delivery';
import { formatFCFA } from '../../utils/format';

function Tile({ to, icon: Icon, label, value, tone }) {
  const tones = { amber: 'bg-amber-100 text-amber-700', sky: 'bg-sky-100 text-sky-700', brand: 'bg-brand-500/15 text-brand-700' };
  return (
    <Link to={to} className="card flex flex-col items-center gap-1.5 px-2 py-4 text-center transition hover:border-brand-500/40">
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${tones[tone]}`}>
        <Icon size={18} />
      </span>
      <span className="font-display text-2xl font-bold leading-none text-ink" data-testid={`tile-${tone}`}>{value}</span>
      <span className="text-xs text-ink/55">{label}</span>
    </Link>
  );
}

export default function DriverHome() {
  usePageMeta('Espace livreur');
  const user = useAuthStore((s) => s.user);
  const summary = useDriverStore((s) => s.summary);
  const active = useDriverStore((s) => s.active);
  const error = useDriverStore((s) => s.error);
  const refresh = useDriverStore((s) => s.refresh);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const { todo, progress, next } = useMemo(() => {
    const list = active || [];
    return {
      todo: list.filter((d) => deliveryGroup(d) === 'todo').length,
      progress: list.filter((d) => deliveryGroup(d) === 'progress').length,
      next: pickNextDelivery(list),
    };
  }, [active]);

  const name = user?.firstName || '';
  const pending = todo + progress;
  const status = summary?.status || user?.driverProfile?.status;

  return (
    <div className="space-y-5">
      <section className="card p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pine-900 font-display text-base font-bold text-brand-500" aria-hidden="true">
            {initialsOf(`${user?.firstName || ''} ${user?.lastName || ''}`)}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold text-ink">Bonjour, {name || 'livreur'}</h1>
            <p className="text-sm text-ink/60">
              {active === null
                ? 'Chargement de vos livraisons…'
                : pending > 0
                ? `Vous avez ${pending} livraison${pending > 1 ? 's' : ''} à effectuer.`
                : 'Aucune livraison à effectuer pour le moment.'}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <AvailabilityPicker />
        </div>
      </section>

      {active === null ? (
        <div className="grid grid-cols-3 gap-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-28 rounded-xl2" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Tile to="/livreur/livraisons?onglet=en-cours" icon={Truck} tone="amber" label="En cours" value={progress} />
          <Tile to="/livreur/livraisons?onglet=a-faire" icon={PackageCheck} tone="sky" label="À livrer" value={todo} />
          <Tile to="/livreur/historique" icon={CheckCircle2} tone="brand" label="Terminées" value={summary?.delivered ?? 0} />
        </div>
      )}

      {error && active !== null && active.length === 0 && !summary && (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Impossible de charger vos livraisons. Vérifiez votre connexion : l'écran se mettra à jour tout seul.
        </p>
      )}

      {next ? (
        <section aria-labelledby="next-title">
          <h2 id="next-title" className="mb-2 font-display text-base font-semibold text-ink">
            {next.status === 'PICKED_UP' || next.status === 'ON_ROUTE' ? 'Livraison en cours' : 'Prochaine livraison'}
          </h2>
          <DeliveryCard delivery={next} cta="Voir les détails" />
        </section>
      ) : (
        active !== null && (
          <EmptyState
            icon={PackageSearch}
            title="Aucune livraison en attente"
            description={status && status !== 'AVAILABLE' ? 'Passez en « Disponible » pour recevoir de nouvelles livraisons.' : 'Les nouvelles livraisons apparaîtront ici automatiquement.'}
          />
        )
      )}

      {summary && (
        <section className="card flex items-center gap-3 p-4" aria-label="Bilan du jour">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mist text-brand-700">
            <Banknote size={19} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              Aujourd'hui : {summary.today.delivered} livraison{summary.today.delivered > 1 ? 's' : ''} terminée{summary.today.delivered > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-ink/55">Espèces encaissées : {formatFCFA(summary.today.cashCollected)}</p>
          </div>
        </section>
      )}
    </div>
  );
}
