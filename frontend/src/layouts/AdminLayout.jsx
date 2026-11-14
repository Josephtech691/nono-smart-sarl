import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Tags,
  ClipboardList,
  Truck,
  PackageCheck,
  CreditCard,
  Star,
  Ticket,
  Wallet,
  Menu,
  LogOut,
  Users,
  LineChart,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import ToastContainer from '../components/ToastContainer';
import NotificationBell from '../components/NotificationBell';

// Même ordre que la maquette : l'essentiel du quotidien d'abord.
const MAIN_NAV = [
  { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/admin/produits', label: 'Produits', icon: Package },
  { to: '/admin/categories', label: 'Catégories', icon: Tags },
  { to: '/admin/commandes', label: 'Commandes', icon: ClipboardList },
  { to: '/admin/clients', label: 'Clients', icon: Users },
  { to: '/admin/livreurs', label: 'Livreurs', icon: Truck },
  { to: '/admin/livraisons', label: 'Livraisons', icon: PackageCheck },
  { to: '/admin/paiements', label: 'Paiements', icon: CreditCard },
  { to: '/admin/promotions', label: 'Promotions', icon: Ticket },
  { to: '/admin/statistiques', label: 'Statistiques', icon: LineChart },
];

const QUICK_NAV = [
  { to: '/admin', label: 'Accueil', icon: LayoutDashboard, end: true },
  { to: '/admin/commandes', label: 'Commandes', icon: ClipboardList },
  { to: '/admin/produits', label: 'Produits', icon: Package },
  { to: '/admin/clients', label: 'Clients', icon: Users },
];

const MORE_NAV = [
  { to: '/admin/avis', label: 'Avis clients', icon: Star },
  { to: '/admin/finances', label: 'Dépenses & bénéfices', icon: Wallet },
];

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Menu mobile : se ferme au changement de page, à Échap, et bloque le défilement de la page derrière.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleLogout = () => {
    logout();
    navigate('/admin/connexion');
  };

  const renderLink = ({ to, label, icon: Icon, end }) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={() => setOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
          isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      <Icon size={17} />
      {label}
    </NavLink>
  );

  const SidebarContent = (
    <>
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white p-1">
          <img src="/brand/logo-icon-raw.png" alt="" className="h-full w-full object-contain" />
        </span>
        <div className="leading-none">
          <p className="font-display text-sm font-bold text-white">Fresh Fish</p>
          <p className="text-[11px] text-white/40">Administration</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3" aria-label="Administration">
        {MAIN_NAV.map(renderLink)}
        <p className="mt-4 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/30">Autres réglages</p>
        {MORE_NAV.map(renderLink)}
      </nav>
      <div className="border-t border-white/10 px-3 py-4">
        <p className="px-3 pb-2 text-xs text-white/40">Connecté : {user?.firstName}</p>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white"
        >
          <LogOut size={17} /> Déconnexion
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-mist" style={{ minHeight: '100dvh' }}>
      {/* Le menu reste en place quand la page défile (la déconnexion en bas ne part pas avec le contenu). */}
      <aside className="hidden w-64 shrink-0 flex-col bg-pine-950 md:sticky md:top-0 md:flex md:h-screen">{SidebarContent}</aside>

      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-pine-950 pb-[env(safe-area-inset-bottom)]">{SidebarContent}</div>
          <button className="flex-1 bg-black/40" onClick={() => setOpen(false)} aria-label="Fermer le menu" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Un seul en-tête (un seul exemplaire de la cloche, donc une seule interrogation du serveur). */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur md:px-6">
          <span className="font-display font-bold text-pine-900 md:hidden">Administration</span>
          <p className="hidden text-sm text-ink/55 md:block">
            Bonjour <span className="font-semibold text-ink">{user?.firstName}</span>
          </p>
          <div className="flex items-center gap-1">
            <NotificationBell tone="light" />
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Ouvrir le menu"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink/80 hover:bg-mist md:hidden"
            >
              <Menu size={22} />
            </button>
          </div>
        </header>
        <main className="min-w-0 max-w-full flex-1 overflow-x-clip p-4 pb-28 sm:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>
      {/* Mobile : accès rapide par icônes aux écrans les plus utilisés ; « Menu » ouvre toutes les rubriques. */}
      <nav aria-label="Accès rapide" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {QUICK_NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} aria-label={label} className={({ isActive }) => `flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${isActive ? 'text-brand-700' : 'text-ink/50'}`}>
                <Icon size={21} /> {label}
              </NavLink>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setOpen(true)} aria-label="Menu" className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-ink/50">
              <Menu size={21} /> Menu
            </button>
          </li>
        </ul>
      </nav>
      <ToastContainer />
    </div>
  );
}
