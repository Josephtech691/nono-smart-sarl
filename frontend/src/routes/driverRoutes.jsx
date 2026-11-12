import { Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import DriverLayout from '../layouts/DriverLayout';
import DriverLogin from '../pages/driver/Login';
import DriverHome from '../pages/driver/Home';
import DriverDeliveries from '../pages/driver/Deliveries';
import DriverDeliveryDetail from '../pages/driver/DeliveryDetail';
import DriverDeliveryConfirm from '../pages/driver/DeliveryConfirm';
import DriverHistory from '../pages/driver/History';
import DriverProfile from '../pages/driver/Profile';
import DriverNotifications from '../pages/driver/Notifications';

// Application LIVREURS : espace livreur (réservé au rôle DRIVER).
export function driverRoutes() {
  return (
    <>
    <Route path="/livreur/connexion" element={<DriverLogin />} />
    <Route
      path="/livreur"
      element={
        <ProtectedRoute role="DRIVER" redirectTo="/livreur/connexion">
          <DriverLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<DriverHome />} />
      <Route path="livraisons" element={<DriverDeliveries />} />
      <Route path="livraisons/:orderId" element={<DriverDeliveryDetail />} />
      <Route path="livraisons/:orderId/confirmer" element={<DriverDeliveryConfirm />} />
      <Route path="historique" element={<DriverHistory />} />
      <Route path="notifications" element={<DriverNotifications />} />
      <Route path="profil" element={<DriverProfile />} />
      <Route path="*" element={<Navigate to="/livreur" replace />} />
    </Route>
    </>
  );
}
