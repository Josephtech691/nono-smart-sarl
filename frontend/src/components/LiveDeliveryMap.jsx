import { Navigation2 } from 'lucide-react';
import MapView from './MapView';

export default function LiveDeliveryMap({ order }) {
  const delivery = order.delivery;
  const driver = delivery?.driver;
  const driverIsLive =
    ['PICKED_UP', 'ON_ROUTE'].includes(delivery?.status) && driver?.lastLatitude != null && driver?.lastLongitude != null;
  const destination = order.address?.latitude != null ? [order.address.latitude, order.address.longitude] : null;

  if (!driverIsLive && !destination) return null;

  const markers = [];
  if (destination) markers.push({ position: destination, label: 'Adresse de livraison', color: 'brand' });
  if (driverIsLive) {
    markers.push({
      position: [driver.lastLatitude, driver.lastLongitude],
      label: `${driver.user?.firstName || 'Livreur'} en route`,
      color: 'pine',
    });
  }

  return (
    <div className="card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-display font-semibold">
        <Navigation2 size={16} className="text-brand-600" /> Suivi en direct
      </h2>
      <MapView center={markers[0].position} markers={markers} height={240} />
      {driverIsLive ? (
        <p className="mt-2 text-xs text-brand-700">Position du livreur mise à jour automatiquement.</p>
      ) : (
        <p className="mt-2 text-xs text-ink/45">La position du livreur s'affichera ici une fois la commande récupérée.</p>
      )}
    </div>
  );
}
