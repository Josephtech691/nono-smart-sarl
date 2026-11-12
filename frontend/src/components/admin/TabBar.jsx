/**
 * Onglets en pastilles avec compteur (Toutes 134 · En attente 6 …). Défilent horizontalement sur mobile.
 * `tabs` : [{ value, label, count?, alert? }] ; `value` : onglet actif. Un onglet `alert` met son compteur en rouge
 * tant qu'il n'est pas à zéro (ex. « Problèmes »).
 */
export default function TabBar({ tabs, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value || 'all'}
            type="button"
            role="tab"
            aria-selected={active}
            data-tab={tab.value || 'all'}
            onClick={() => onChange(tab.value)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              active ? 'bg-pine-900 text-white' : 'bg-white text-ink/70 ring-1 ring-line hover:bg-mist'
            }`}
          >
            {tab.label}
            {tab.count != null && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  active ? 'bg-white/20 text-white' : tab.alert && tab.count > 0 ? 'bg-red-100 text-red-700' : 'bg-mist text-ink/60'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
