import { useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PackageSearch, Truck, ArrowRight } from 'lucide-react';
import { useDriverStore } from '../../store/driverStore';
import DeliveryCard from '../../components/driver/DeliveryCard';
import HistoryFeed from '../../components/driver/HistoryFeed';
import EmptyState from '../../components/EmptyState';
import Loader from '../../components/Loader';
import usePageMeta from '../../utils/usePageMeta';
import { deliveryGroup, sortTodo } from '../../utils/delivery';

const TABS = [
  { key: 'a-faire', label: 'À faire' },
  { key: 'en-cours', label: 'En cours' },
  { key: 'terminees', label: 'Terminées' },
];

export default function DriverDeliveries() {
  usePageMeta('Mes livraisons');
  const [params, setParams] = useSearchParams();
  const active = useDriverStore((s) => s.active);
  const summary = useDriverStore((s) => s.summary);
  const error = useDriverStore((s) => s.error);

  const { todo, progress } = useMemo(() => {
    const list = active || [];
    return {
      todo: sortTodo(list.filter((d) => deliveryGroup(d) === 'todo')),
      progress: list.filter((d) => deliveryGroup(d) === 'progress'),
    };
  }, [active]);

  // Onglet d'ouverture : le premier qui contient quelque chose. Décidé une seule fois, pour que
  // l'écran ne change pas sous les doigts du livreur quand une nouvelle livraison arrive.
  const autoTab = useRef(null);
  if (autoTab.current === null && active !== null) {
    autoTab.current = todo.length === 0 && progress.length > 0 ? 'en-cours' : 'a-faire';
  }

  const requested = params.get('onglet');
  const tab = TABS.some((t) => t.key === requested) ? requested : autoTab.current || 'a-faire';
  const choose = (key) => setParams({ onglet: key }, { replace: true });

  const doneCount = summary ? summary.delivered + summary.failed : null;
  const counts = { 'a-faire': active === null ? null : todo.length, 'en-cours': active === null ? null : progress.length, terminees: doneCount };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink">Mes livraisons</h1>

      <div role="tablist" aria-label="Filtrer mes livraisons" className="grid grid-cols-3 gap-1 rounded-xl2 bg-white p-1 shadow-sm ring-1 ring-line">
        {TABS.map(({ key, label }) => {
          const selected = tab === key;
          const count = counts[key];
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={selected}
              aria-controls="deliveries-panel"
              onClick={() => choose(key)}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-medium transition ${
                selected ? 'bg-pine-900 text-white shadow' : 'text-ink/60 hover:bg-mist'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 text-[11px] font-bold leading-5 ${selected ? 'bg-white/20 text-white' : 'bg-mist text-ink/60'}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {error && active !== null && active.length === 0 && !summary && (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Impossible de charger vos livraisons. Vérifiez votre connexion : l'écran se mettra à jour tout seul.
        </p>
      )}

      <section id="deliveries-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="space-y-3">
        {tab === 'terminees' ? (
          <>
            <HistoryFeed pageSize={10} grouped={false} />
            <Link to="/livreur/historique" className="flex items-center justify-center gap-1.5 py-1 text-sm font-medium text-brand-700 hover:underline">
              Voir tout l'historique par jour <ArrowRight size={15} />
            </Link>
          </>
        ) : active === null ? (
          <Loader />
        ) : tab === 'a-faire' ? (
          todo.length ? (
            todo.map((d) => <DeliveryCard key={d.id} delivery={d} cta="Voir les détails" />)
          ) : (
            <EmptyState icon={PackageSearch} title="Aucune livraison à faire" description="Les nouvelles livraisons assignées par l'administration apparaîtront ici automatiquement." />
          )
        ) : progress.length ? (
          progress.map((d) => <DeliveryCard key={d.id} delivery={d} cta="Continuer la livraison" />)
        ) : (
          <EmptyState icon={Truck} title="Aucune livraison en cours" description="Ouvrez une livraison de l'onglet « À faire » et touchez « Commencer la livraison »." />
        )}
      </section>
    </div>
  );
}
