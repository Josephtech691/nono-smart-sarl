import { Check, X, Circle } from 'lucide-react';
import { ORDER_STATUS_ORDER, ORDER_STATUS_LABELS } from '../utils/format';

export default function StatusTimeline({ status }) {
  if (status === 'CANCELLED') {
    return (
      <div className="flex items-center gap-3 rounded-xl2 border border-red-200 bg-red-50 px-4 py-3 text-red-700">
        <X size={20} />
        <span className="font-medium">Cette commande a été annulée.</span>
      </div>
    );
  }

  const currentIndex = ORDER_STATUS_ORDER.indexOf(status);

  return (
    <ol className="flex flex-col gap-0">
      {ORDER_STATUS_ORDER.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const isLast = i === ORDER_STATUS_ORDER.length - 1;
        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  done
                    ? 'bg-brand-600 text-white'
                    : current
                    ? 'bg-pine-900 text-white'
                    : 'bg-mist text-ink/30'
                }`}
              >
                {done ? <Check size={15} /> : <Circle size={9} className={current ? 'fill-white' : 'fill-current'} />}
              </span>
              {!isLast && <span className={`w-px flex-1 ${done ? 'bg-brand-600' : 'bg-line'}`} style={{ minHeight: 22 }} />}
            </div>
            <p className={`pb-5 pt-0.5 text-sm ${current ? 'font-semibold text-ink' : done ? 'text-ink/70' : 'text-ink/35'}`}>
              {ORDER_STATUS_LABELS[step]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
