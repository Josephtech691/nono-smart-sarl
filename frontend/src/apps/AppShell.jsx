import { useEffect } from 'react';
import { Routes } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import ScrollManager from '../components/ScrollManager';

// Coque commune aux applications : restaure la session puis affiche les routes de l'application.
export default function AppShell({ children }) {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <>
      <ScrollManager />
      <Routes>{children}</Routes>
    </>
  );
}
