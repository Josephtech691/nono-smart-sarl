import { Route, Navigate } from 'react-router-dom';
import AppShell from './AppShell';
import { driverRoutes } from '../routes/driverRoutes';

// Application 2/3 — LIVREURS : espace livreur. Toute autre adresse renvoie vers l'espace livreur.
export default function DriverApp() {
  return (
    <AppShell>
      {driverRoutes()}
      <Route path="*" element={<Navigate to="/livreur" replace />} />
    </AppShell>
  );
}
