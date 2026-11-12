import AppShell from './AppShell';
import { clientRoutes } from '../routes/clientRoutes';

// Application 1/3 — CLIENTS : site public, panier, commande, espace client. Aucun accès admin / livreur.
export default function ClientApp() {
  return <AppShell>{clientRoutes()}</AppShell>;
}
