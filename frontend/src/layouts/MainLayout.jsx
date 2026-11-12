import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import WhatsAppButton from '../components/WhatsAppButton';
import MobileBottomNav, { showsBottomNav } from '../components/MobileBottomNav';
import ToastContainer from '../components/ToastContainer';
import useSpecialPrices from '../hooks/useSpecialPrices';

export default function MainLayout() {
  const { pathname } = useLocation();
  const bottomNav = showsBottomNav(pathname);
  // Prix négociés du client connecté (panier, fiche produit).
  useSpecialPrices();

  return (
    // pb-16 : la barre de navigation mobile (h-16) ne doit pas masquer le bas de page.
    <div className={`flex min-h-screen flex-col ${bottomNav ? 'pb-24 lg:pb-0' : ''}`}>
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <WhatsAppButton raised={bottomNav} />
      {bottomNav && <MobileBottomNav />}
      <ToastContainer />
    </div>
  );
}
