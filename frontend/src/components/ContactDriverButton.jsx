import { Phone } from 'lucide-react';

// Statuts pendant lesquels le client peut raisonnablement appeler son livreur.
const CALLABLE_STATUSES = ['ASSIGNED', 'PICKED_UP', 'ON_DELIVERY'];

/**
 * Bouton "Appeler le livreur" (lien tel:) affiche seulement quand un livreur
 * est assigne et que la commande est en cours d'acheminement.
 *
 * Forme des donnees renvoyee par l'API : order.delivery.driver est un profil
 * livreur dont le nom et le telephone sont dans driver.user.
 */
export default function ContactDriverButton({ order, className = '', compact = false }) {
  const driver = order?.delivery?.driver;
  const user = driver?.user;
  const phone = user?.phone || driver?.phone;
  if (!driver || !phone || !CALLABLE_STATUSES.includes(order?.status)) return null;

  const tel = String(phone).replace(/[^\d+]/g, '');
  const firstName = user?.firstName || driver?.firstName;
  const label = firstName ? `Appeler ${firstName}` : 'Appeler le livreur';

  return (
    <a
      href={`tel:${tel}`}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-pine-900 font-display font-semibold text-white transition hover:bg-pine-800 ${
        compact ? 'px-4 py-2 text-sm' : 'px-5 py-3'
      } ${className}`}
    >
      <Phone size={compact ? 15 : 17} />
      {label}
    </a>
  );
}
