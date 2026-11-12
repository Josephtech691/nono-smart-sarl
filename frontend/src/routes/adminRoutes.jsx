import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import AdminLayout from '../layouts/AdminLayout';
import AdminLogin from '../pages/admin/Login';
import AdminDashboard from '../pages/admin/Dashboard';
import AdminProducts from '../pages/admin/Products';
import AdminCategories from '../pages/admin/Categories';
import AdminOrders from '../pages/admin/Orders';
import AdminOrderDetail from '../pages/admin/OrderDetail';
import AdminDrivers from '../pages/admin/Drivers';
import AdminDeliveries from '../pages/admin/Deliveries';
import AdminPayments from '../pages/admin/Payments';
import AdminZones from '../pages/admin/Zones';
import AdminReviews from '../pages/admin/Reviews';
import AdminCoupons from '../pages/admin/Coupons';
import AdminFinances from '../pages/admin/Finances';
import AdminCustomers from '../pages/admin/Customers';
import AdminStatistics from '../pages/admin/Statistics';

// Application ADMIN : back-office (réservé au rôle ADMIN).
export function adminRoutes() {
  return (
    <>
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
      <Route path="livraisons" element={<AdminDeliveries />} />
      <Route path="paiements" element={<AdminPayments />} />
      <Route path="zones" element={<AdminZones />} />
      <Route path="avis" element={<AdminReviews />} />
      <Route path="promotions" element={<AdminCoupons />} />
      <Route path="statistiques" element={<AdminStatistics />} />
      <Route path="clients" element={<AdminCustomers />} />
      <Route path="finances" element={<AdminFinances />} />
    </Route>
    </>
  );
}
