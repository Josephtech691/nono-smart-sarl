import { Route, Navigate } from 'react-router-dom';
import AppShell from './AppShell';
import { adminRoutes } from '../routes/adminRoutes';

// Application 3/3 — ADMIN : back-office. Toute autre adresse renvoie vers l'administration.
export default function AdminApp() {
  return (
    <AppShell>
      {adminRoutes()}
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </AppShell>
  );
}
