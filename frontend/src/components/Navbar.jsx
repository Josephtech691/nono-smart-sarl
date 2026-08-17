import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Fish, ShoppingCart, Menu, X, User, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';

const LINKS = [
  { to: '/', label: 'Accueil' },
  { to: '/produits', label: 'Produits' },
  { to: '/suivi-commande', label: 'Suivre ma commande' },
  { to: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const cartCount = useCartStore((s) => s.items.length);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pine-900 text-white">
            <Fish size={18} />
          </span>
          <span className="font-display leading-none">
            <span className="block text-base font-extrabold tracking-tight text-ink">
              NONO <span className="text-brand-600">SMART</span>
            </span>
            <span className="block text-[10px] font-semibold tracking-wider text-ink/40">SARL</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `text-sm font-medium transition hover:text-brand-700 ${isActive ? 'text-brand-700' : 'text-ink/70'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/panier"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink/80 transition hover:bg-mist"
            aria-label="Panier"
          >
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>

          {user ? (
            <div className="hidden items-center gap-1 sm:flex">
              <Link
                to="/compte/commandes"
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-ink/80 transition hover:bg-mist"
              >
                <User size={16} />
                {user.firstName}
              </Link>
              <button
                onClick={handleLogout}
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink/60 transition hover:bg-mist"
                aria-label="Déconnexion"
                title="Déconnexion"
              >
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <Link to="/connexion" className="btn-primary hidden !px-4 !py-2 text-sm sm:inline-flex">
              Connexion
            </Link>
          )}

          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink/80 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-white px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink/80 hover:bg-mist"
              >
                {l.label}
              </NavLink>
            ))}
            {user ? (
              <>
                <NavLink to="/compte/commandes" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink/80 hover:bg-mist">
                  Mon compte
                </NavLink>
                <button onClick={handleLogout} className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-mist">
                  Déconnexion
                </button>
              </>
            ) : (
              <NavLink to="/connexion" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-mist">
                Connexion / Créer un compte
              </NavLink>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
