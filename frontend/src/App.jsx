import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';

import { useAuthStore } from './store/authStore';

import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import DriverLayout from './layouts/DriverLayout';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Catalogue from './pages/Catalogue';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import OrderTracking from './pages/OrderTracking';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';

import Login from './pages/account/Login';
import Register from './pages/account/Register';
import Profile from './pages/account/Profile';
import Orders from './pages/account/Orders';
import OrderDetail from './pages/account/OrderDetail';
import Addresses from './pages/account/Addresses';
import Favorites from './pages/account/Favorites';
import RecurringOrders from './pages/account/RecurringOrders';
import ProfessionalAccount from './pages/account/ProfessionalAccount';
import Referral from './pages/account/Referral';

import AdminLogin from './pages/admin/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminProducts from './pages/admin/Products';
import AdminCategories from './pages/admin/Categories';
import AdminOrders from './pages/admin/Orders';
import AdminOrderDetail from './pages/admin/OrderDetail';
import AdminDrivers from './pages/admin/Drivers';
import AdminZones from './pages/admin/Zones';
import AdminReviews from './pages/admin/Reviews';
import AdminCoupons from './pages/admin/Coupons';
import AdminFinances from './pages/admin/Finances';
import AdminCustomers from './pages/admin/Customers';
import AdminStatistics from './pages/admin/Statistics';

import DriverLogin from './pages/driver/Login';
import DriverDeliveries from './pages/driver/Deliveries';
import DriverDeliveryDetail from './pages/driver/DeliveryDetail';

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <Routes>
      {/* --- Site public + espace client --- */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/produits" element={<Catalogue />} />
        <Route path="/produits/:slug" element={<ProductDetail />} />
        <Route path="/panier" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/commande-confirmee/:id" element={<OrderConfirmation />} />
        <Route path="/suivi-commande" element={<OrderTracking />} />
        <Route path="/suivi-commande/:orderNumber" element={<OrderTracking />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/connexion" element={<Login />} />
        <Route path="/inscription" element={<Register />} />

        <Route path="/compte/profil" element={<ProtectedRoute role="CUSTOMER"><Profile /></ProtectedRoute>} />
        <Route path="/compte/commandes" element={<ProtectedRoute role="CUSTOMER"><Orders /></ProtectedRoute>} />
        <Route path="/compte/commandes/:id" element={<ProtectedRoute role="CUSTOMER"><OrderDetail /></ProtectedRoute>} />
        <Route path="/compte/adresses" element={<ProtectedRoute role="CUSTOMER"><Addresses /></ProtectedRoute>} />
        <Route path="/compte/favoris" element={<ProtectedRoute role="CUSTOMER"><Favorites /></ProtectedRoute>} />
        <Route path="/compte/commandes-recurrentes" element={<ProtectedRoute role="CUSTOMER"><RecurringOrders /></ProtectedRoute>} />
        <Route path="/compte/professionnel" element={<ProtectedRoute role="CUSTOMER"><ProfessionalAccount /></ProtectedRoute>} />
        <Route path="/compte/parrainage" element={<ProtectedRoute role="CUSTOMER"><Referral /></ProtectedRoute>} />

        <Route path="*" element={<NotFound />} />
      </Route>

      {/* --- Administration --- */}
      <Route path="/admin/connexion" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="ADMIN" redirectTo="/admin/connexion">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="commandes" element={<AdminOrders />} />
        <Route path="commandes/:id" element={<AdminOrderDetail />} />
        <Route path="produits" element={<AdminProducts />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="livreurs" element={<AdminDrivers />} />
        <Route path="zones" element={<AdminZones />} />
        <Route path="avis" element={<AdminReviews />} />
        <Route path="promotions" element={<AdminCoupons />} />
        <Route path="statistiques" element={<AdminStatistics />} />
        <Route path="clients" element={<AdminCustomers />} />
        <Route path="finances" element={<AdminFinances />} />
      </Route>

      {/* --- Espace livreur --- */}
      <Route path="/livreur/connexion" element={<DriverLogin />} />
      <Route
        path="/livreur"
        element={
          <ProtectedRoute role="DRIVER" redirectTo="/livreur/connexion">
            <DriverLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DriverDeliveries />} />
        <Route path="livraisons/:orderId" element={<DriverDeliveryDetail />} />
      </Route>
    </Routes>
  );
}
