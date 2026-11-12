import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Loader from './Loader';

// Protege une route selon le statut de connexion et, optionnellement, le role
// attendu. redirectTo permet de renvoyer vers /admin/connexion ou
// /livreur/connexion selon le contexte plutot que /connexion (client).
export default function ProtectedRoute({ children, role, redirectTo = '/connexion' }) {
  const { user, status } = useAuthStore();
  const location = useLocation();

  if (status !== 'ready') return <Loader label="Vérification de la session..." />;

  if (!user) return <Navigate to={redirectTo} state={{ from: location }} replace />;

  if (role && user.role !== role) {
    // Espace du personnel (admin / livreur) : retour à sa page de connexion ; espace client : accueil.
    return <Navigate to={redirectTo === '/connexion' ? '/' : redirectTo} replace />;
  }

  return children;
}
