// Informations de l'entreprise, reprises de la maquette fournie.
export const COMPANY_NAME = 'Fresh Fish';
export const COMPANY_TAGLINE = 'Fraîcheur • Qualité • Confiance';
export const COMPANY_SUBTAGLINE = 'Du bassin à votre maison !';
export const COMPANY_PHONE_DISPLAY = '659 103 000';
export const COMPANY_PHONE = '659103000';
export const WHATSAPP_NUMBER_DISPLAY = '674 331 099';
export const WHATSAPP_NUMBER = '237674331099'; // format international pour wa.me
export const COMPANY_ADDRESS = 'Essos Madison, Yaoundé';
export const COMPANY_CITY = 'Yaoundé';

// Adresses publiques des trois applications (utiles quand elles sont hébergées séparément).
// Laisser vide en développement / site unique : l'adresse du site courant est utilisée.
const trim = (v) => String(v || '').replace(/\/+$/, '');
export const CLIENT_APP_URL = trim(import.meta.env.VITE_CLIENT_URL);
export const DRIVER_APP_URL = trim(import.meta.env.VITE_DRIVER_URL);
export const ADMIN_APP_URL = trim(import.meta.env.VITE_ADMIN_URL);

// Frais de livraison : tarif unique, quelle que soit la distance (même valeur que DELIVERY_FEE côté serveur,
// qui reste seul juge du montant facturé).
export const FLAT_DELIVERY_FEE = 1000;
