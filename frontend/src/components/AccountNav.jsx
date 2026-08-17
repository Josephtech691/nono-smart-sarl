import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/compte/profil', label: 'Profil' },
  { to: '/compte/commandes', label: 'Commandes' },
  { to: '/compte/commandes-recurrentes', label: 'Commandes récurrentes' },
  { to: '/compte/adresses', label: 'Adresses' },
  { to: '/compte/favoris', label: 'Favoris' },
  { to: '/compte/professionnel', label: 'Compte pro' },
  { to: '/compte/parrainage', label: 'Parrainage' },
];

export default function AccountNav() {
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {LINKS.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          className={({ isActive }) =>
            `whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink/55 hover:text-ink'
            }`
          }
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
