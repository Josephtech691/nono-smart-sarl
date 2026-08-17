import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useToastStore } from '../store/toastStore';

const STYLES = {
  success: { icon: CheckCircle2, className: 'border-brand-600/20 bg-white text-ink [&_svg]:text-brand-600' },
  error: { icon: XCircle, className: 'border-red-200 bg-white text-ink [&_svg]:text-red-600' },
  info: { icon: Info, className: 'border-line bg-white text-ink [&_svg]:text-pine-700' },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
      {toasts.map((t) => {
        const { icon: Icon, className } = STYLES[t.type] || STYLES.info;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm animate-toast-in items-center gap-2.5 rounded-xl2 border px-4 py-3 shadow-card ${className}`}
          >
            <Icon size={18} className="shrink-0" />
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            <button onClick={() => removeToast(t.id)} className="shrink-0 text-ink/30 hover:text-ink/60" aria-label="Fermer">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
