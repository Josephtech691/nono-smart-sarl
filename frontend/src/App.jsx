import AppShell from './apps/AppShell';
import { clientRoutes } from './routes/clientRoutes';
import { adminRoutes } from './routes/adminRoutes';
import { driverRoutes } from './routes/driverRoutes';

// Site complet (développement / hébergement unique) : les trois espaces dans une seule application.
// Les adresses /admin/connexion et /livreur/connexion fonctionnent si on les tape, mais aucun lien
// public n'y mène. Pour publier trois applications distinctes, voir frontend/README.md
// (npm run build:client | build:driver | build:admin).
export default function App() {
  return (
    <AppShell>
      {clientRoutes()}
      {adminRoutes()}
      {driverRoutes()}
    </AppShell>
  );
}
