import { Link } from 'react-router-dom';

/**
 * Barre de navigation du bas : uniquement des icônes (comme les applications mobiles), avec le bouton
 * « Accueil » au centre, dans un rond en relief. Utilisée par l'espace client et l'espace livreur.
 *
 * items : exactement 5 entrées { key, to, label, icon, active, badge? } ; la 3e (centre) est le bouton en relief.
 * Le libellé n'est pas affiché mais reste lu par les lecteurs d'écran (aria-label).
 */
export default function IconTabBar({ items, label, className = '', gapClass = 'border-paper' }) {
  return (
    <nav aria-label={label} className={`fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)] ${className}`}>
      <div className="relative mx-auto max-w-md px-3 pb-2">
        <ul className="grid h-16 grid-cols-5 items-center rounded-[1.75rem] border border-line bg-white px-1 shadow-[0_-6px_28px_-8px_rgba(15,61,44,0.28)]">
          {items.map(({ key, to, label: itemLabel, icon: Icon, active, badge }, index) => {
            const center = index === 2;
            return (
              <li key={key} className="flex justify-center">
                <Link
                  to={to}
                  aria-label={itemLabel}
                  aria-current={active ? 'page' : undefined}
                  title={itemLabel}
                  className={
                    center
                      ? `relative -mt-9 flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full border-4 ${gapClass} bg-brand-700 text-white shadow-lg transition active:scale-95 ${active ? 'ring-2 ring-brand-500/40' : ''}`
                      : `relative flex h-12 w-12 items-center justify-center rounded-full transition active:scale-90 ${active ? 'text-brand-700' : 'text-ink/50'}`
                  }
                >
                  <span className="relative">
                    <Icon size={center ? 26 : 24} strokeWidth={active || center ? 2.3 : 1.8} />
                    {badge > 0 && (
                      <span className="absolute -right-2.5 -top-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-none text-white">
                        {badge}
                      </span>
                    )}
                  </span>
                  {active && !center && <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-brand-600" aria-hidden="true" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
