import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Tags,
  ClipboardList,
  Truck,
  MapPin,
  Star,
  Ticket,
  Wallet,
  Menu,
  X,
  LogOut,
  Fish,
  Users,
  LineChart,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import ToastContainer from '../components/ToastContainer';

const NAV = [
  { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/admin/commandes', label: 'Commandes', icon: ClipboardList },
  { to: '/admin/produits', label: 'Produits', icon: Package },
  { to: '/admin/categories', label: 'Catégories', icon: Tags },
  { to: '/admin/clients', label: 'Clients', icon: Users },
  { to: '/admin/livreurs', label: 'Livreurs', icon: Truck },
  { to: '/admin/zones', label: 'Zones de livraison', icon: MapPin },
  { to: '/admin/avis', label: 'Avis clients', icon: Star },
  { to: '/admin/promotions', label: 'Codes promo', icon: Ticket },
  { to: '/admin/statistiques', label: 'Statistiques avancées', icon: LineChart },
  { to: '/admin/finances', label: 'Dépenses & bénéfices', icon: Wallet },
];

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/connexion');
  };

  const SidebarContent = (
    <>
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white">
          <Fish size={18} />
        </span>
        <div className="leading-none">
          <p className="font-display text-sm font-bold text-white">NONO SMART</p>
          <p className="text-[11px] text-white/40">Administration</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
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
        ))}
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
    <div className="flex min-h-screen bg-mist">
      <aside className="hidden w-64 flex-col bg-pine-950 md:flex">{SidebarContent}</aside>

      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="flex w-64 flex-col bg-pine-950">{SidebarContent}</div>
          <button className="flex-1 bg-black/40" onClick={() => setOpen(false)} aria-label="Fermer le menu" />
        </div>
      )}

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-line bg-white px-4 md:hidden">
          <span className="font-display font-bold text-pine-900">Administration</span>
          <button onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
            <Menu size={22} />
          </button>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
