import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import MainLayout from '../layouts/MainLayout';
import Home from '../pages/Home';
import Catalogue from '../pages/Catalogue';
import ProductDetail from '../pages/ProductDetail';
import Cart from '../pages/Cart';
import Checkout from '../pages/Checkout';
import OrderConfirmation from '../pages/OrderConfirmation';
import OrderTracking from '../pages/OrderTracking';
import Contact from '../pages/Contact';
import About from '../pages/About';
import Delivery from '../pages/Delivery';
import Terms from '../pages/Terms';
import Privacy from '../pages/Privacy';
import DeleteAccountInfo from '../pages/DeleteAccountInfo';
import NotFound from '../pages/NotFound';
import Login from '../pages/account/Login';
import Register from '../pages/account/Register';
import ForgotPassword from '../pages/account/ForgotPassword';
import AccountDashboard from '../pages/account/Dashboard';
import MyReviews from '../pages/account/MyReviews';
import Profile from '../pages/account/Profile';
import Orders from '../pages/account/Orders';
import OrderDetail from '../pages/account/OrderDetail';
import Addresses from '../pages/account/Addresses';
import Favorites from '../pages/account/Favorites';
import RecurringOrders from '../pages/account/RecurringOrders';
import ProfessionalAccount from '../pages/account/ProfessionalAccount';
import Referral from '../pages/account/Referral';

// Application CLIENTS : site public + espace client.
export function clientRoutes() {
  return (
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
      <Route path="/a-propos" element={<About />} />
      <Route path="/livraison" element={<Delivery />} />
      <Route path="/connexion" element={<Login />} />
      <Route path="/inscription" element={<Register />} />
      <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
      <Route path="/conditions-generales" element={<Terms />} />
      <Route path="/confidentialite" element={<Privacy />} />
      <Route path="/suppression-compte" element={<DeleteAccountInfo />} />

      <Route path="/compte" element={<ProtectedRoute role="CUSTOMER"><AccountDashboard /></ProtectedRoute>} />
      <Route path="/compte/profil" element={<ProtectedRoute role="CUSTOMER"><Profile /></ProtectedRoute>} />
      <Route path="/compte/commandes" element={<ProtectedRoute role="CUSTOMER"><Orders /></ProtectedRoute>} />
      <Route path="/compte/commandes/:id" element={<ProtectedRoute role="CUSTOMER"><OrderDetail /></ProtectedRoute>} />
      <Route path="/compte/adresses" element={<ProtectedRoute role="CUSTOMER"><Addresses /></ProtectedRoute>} />
      <Route path="/compte/favoris" element={<ProtectedRoute role="CUSTOMER"><Favorites /></ProtectedRoute>} />
      <Route path="/compte/commandes-recurrentes" element={<ProtectedRoute role="CUSTOMER"><RecurringOrders /></ProtectedRoute>} />
      <Route path="/compte/professionnel" element={<ProtectedRoute role="CUSTOMER"><ProfessionalAccount /></ProtectedRoute>} />
      <Route path="/compte/parrainage" element={<ProtectedRoute role="CUSTOMER"><Referral /></ProtectedRoute>} />
      <Route path="/compte/avis" element={<ProtectedRoute role="CUSTOMER"><MyReviews /></ProtectedRoute>} />

      <Route path="*" element={<NotFound />} />
    </Route>
  );
}
