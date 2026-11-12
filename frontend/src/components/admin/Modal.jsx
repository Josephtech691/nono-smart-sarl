import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' };

/**
 * Fenêtre modale de l'administration : feuille en bas de l'écran sur mobile, boîte centrée au-dessus.
 * Échap, clic sur le fond et croix la ferment, sauf pendant un envoi (`busy`). Le focus va au premier
 * champ à l'ouverture et revient sur le bouton d'origine à la fermeture. Le contenu (souvent un
 * <form>) est passé en enfant.
 */
export default function Modal({ open, onClose, title, description, icon: Icon, busy = false, size = 'md', children }) {
  const titleId = useId();
  const panelRef = useRef(null);
  // Les gestionnaires lisent la valeur la plus récente sans relancer les effets (sinon le focus
  // reviendrait sur le premier champ à chaque frappe).
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return undefined;
    const origin = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busyRef.current) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => {
      const panel = panelRef.current;
      // Élément marqué data-autofocus en priorité, sinon le premier champ de saisie, sinon la fenêtre elle-même.
      const target =
        panel?.querySelector('[data-autofocus]') || panel?.querySelector('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])');
      (target || panel)?.focus();
    }, 30);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (origin && typeof origin.focus === 'function' && document.contains(origin)) origin.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Fermer" tabIndex={-1} className="absolute inset-0 bg-pine-950/60 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative max-h-[92vh] w-full ${SIZES[size] || SIZES.md} animate-fade-up overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl focus:outline-none sm:rounded-3xl`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="flex items-center gap-2 font-display text-lg font-bold text-ink">
              {Icon && <Icon size={20} className="shrink-0 text-brand-700" />} {title}
            </h2>
            {description && <p className="mt-1 text-sm text-ink/60">{description}</p>}
          </div>
          <button type="button" onClick={() => !busy && onClose()} aria-label="Fermer la fenêtre" className="shrink-0 rounded-full p-1.5 text-ink/50 hover:bg-mist hover:text-ink">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
