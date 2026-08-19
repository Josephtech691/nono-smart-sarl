import { Outlet, useNavigate, Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import ToastContainer from '../components/ToastContainer';

export default function DriverLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/livreur/connexion');
  };

  return (
    <div className="min-h-screen bg-mist">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-pine-950 px-4 text-white">
        <Link to="/livreur" className="flex items-center gap-2">
          <img src="/brand/logo-icon-raw.png" alt="" className="h-7 w-auto" />
          <span className="font-display text-sm font-bold">Espace livreur</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/60">{user?.firstName}</span>
          <button onClick={handleLogout} aria-label="Déconnexion">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-3 py-4 sm:px-4">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}
