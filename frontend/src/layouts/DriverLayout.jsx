import { useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Home, Truck, History, User, Bell } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDriverStore } from '../store/driverStore';
import ToastContainer from '../components/ToastContainer';
import NotificationBell from '../components/NotificationBell';
import GpsBanner from '../components/driver/GpsBanner';
import IconTabBar from '../components/IconTabBar';
import { AVAILABILITY_LABELS } from '../components/driver/AvailabilityPicker';
import useLocationBroadcast from '../hooks/useLocationBroadcast';
import { deliveryGroup } from '../utils/delivery';

// Les nouvelles livraisons assignées par l'administration apparaissent sans recharger la page.
const POLL_MS = 30000;

const DOT = { AVAILABLE: 'bg-brand-500', BUSY: 'bg-amber-400', OFFLINE: 'bg-white/40', SUSPENDED: 'bg-red-400' };

export default function DriverLayout() {
  const { user, logout } = useAuthStore();
  const refresh = useDriverStore((s) => s.refresh);
  const reset = useDriverStore((s) => s.reset);
  const activeCount = useDriverStore((s) => (s.active ? s.active.length : 0));
  const status = useDriverStore((s) => s.summary?.status) || user?.driverProfile?.status || 'OFFLINE';
  // Une livraison est en cours (récupérée / en route) : la position est partagée depuis n'importe quel écran.
  const hasLive = useDriverStore((s) => (s.active || []).some((d) => deliveryGroup(d) === 'progress'));
  useLocationBroadcast(hasLive);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    refresh();
    const tick = () => {
      if (document.visibilityState === 'visible') refresh({ announce: true });
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refresh]);

  const handleLogout = () => {
    logout();
    reset();
    navigate('/livreur/connexion');
  };

  // Pendant la confirmation (clavier ouvert, code à saisir) la barre du bas gênerait.
  const showNav = !/^\/livreur\/livraisons\/[^/]+\/confirmer$/.test(pathname);

  // Barre d'icônes (accueil au centre) : Livraisons · Historique · Accueil · Notifications · Profil.
  const is = (path, exact = false) => (exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`));
  const items = [
    { key: 'deliveries', to: '/livreur/livraisons', label: 'Livraisons', icon: Truck, active: is('/livreur/livraisons'), badge: activeCount },
    { key: 'history', to: '/livreur/historique', label: 'Historique', icon: History, active: is('/livreur/historique') },
    { key: 'home', to: '/livreur', label: 'Accueil', icon: Home, active: is('/livreur', true) },
    { key: 'alerts', to: '/livreur/notifications', label: 'Notifications', icon: Bell, active: is('/livreur/notifications') },
    { key: 'profile', to: '/livreur/profil', label: 'Profil', icon: User, active: is('/livreur/profil') },
  ];

  return (
    <div className={`min-h-screen bg-mist ${showNav ? 'pb-24' : 'pb-8'}`}>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-pine-950 px-4 text-white">
        <Link to="/livreur" className="flex items-center gap-2">
          <img src="/brand/logo-icon-raw.png" alt="" className="h-7 w-auto" />
          <span className="font-display text-sm font-bold">Espace livreur</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80">
            <span className={`h-2 w-2 rounded-full ${DOT[status] || DOT.OFFLINE}`} aria-hidden="true" />
            {AVAILABILITY_LABELS[status] || status}
          </span>
          {/* Pas de bulle « nouvelle notification » : le suivi des livraisons ci-dessus annonce déjà les nouvelles missions. */}
          <NotificationBell tone="dark" toastNew={false} />
          <button type="button" onClick={handleLogout} aria-label="Déconnexion" className="flex h-10 w-8 items-center justify-center text-white/70 hover:text-white">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-5">
        <GpsBanner />
        <Outlet />
      </main>

      {showNav && <IconTabBar items={items} label="Navigation livreur" gapClass="border-mist" />}

      <ToastContainer />
    </div>
  );
}
