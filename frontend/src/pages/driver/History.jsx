import { useEffect } from 'react';
import { useDriverStore } from '../../store/driverStore';
import HistoryFeed from '../../components/driver/HistoryFeed';
import usePageMeta from '../../utils/usePageMeta';
import { formatFCFA } from '../../utils/format';

function Stat({ title, value, detail }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-ink/50">{title}</p>
      <p className="mt-1 font-display text-2xl font-bold leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-xs text-ink/55">{detail}</p>
    </div>
  );
}

const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

export default function DriverHistory() {
  usePageMeta('Historique des livraisons');
  const summary = useDriverStore((s) => s.summary);
  const refresh = useDriverStore((s) => s.refresh);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-bold text-ink">Historique</h1>

      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <Stat title="Aujourd'hui" value={plural(summary.today.delivered, 'livraison')} detail={`${formatFCFA(summary.today.cashCollected)} en espèces`} />
          <Stat title="Depuis le début" value={plural(summary.total.delivered, 'livraison')} detail={`${formatFCFA(summary.total.cashCollected)} en espèces`} />
        </div>
      )}

      <HistoryFeed pageSize={20} grouped />
    </div>
  );
}
