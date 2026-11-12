import LegalLayout from '../components/LegalLayout';
import usePageMeta from '../utils/usePageMeta';
import { COMPANY_NAME, COMPANY_ADDRESS, COMPANY_PHONE_DISPLAY, WHATSAPP_NUMBER_DISPLAY } from '../config';

const SECTIONS = [
  {
    title: 'Qui est responsable de vos données ?',
    paragraphs: [`${COMPANY_NAME}, ${COMPANY_ADDRESS}, est responsable du traitement des données collectées sur ce site.`],
  },
  {
    title: 'Quelles données collectons-nous ?',
    paragraphs: ['Nous ne collectons que ce qui est nécessaire pour traiter et livrer vos commandes :'],
    list: [
      'Identité et coordonnées : nom, prénom, numéro de téléphone, email (facultatif).',
      'Adresses de livraison : quartier, point de repère et, si vous la partagez, votre position GPS.',
      'Commandes : produits, montants, mode de paiement et, pour un paiement Mobile Money, le numéro utilisé.',
      'Avis laissés après livraison.',
      'Informations de compte : votre mot de passe est conservé sous forme chiffrée ; si vous utilisez la connexion Google, nous recevons votre nom et votre adresse email.',
      'Pour une demande de compte professionnel : les informations de votre entreprise que vous nous transmettez.',
    ],
  },
  {
    title: 'Pourquoi utilisons-nous ces données ?',
    paragraphs: [],
    list: [
      'Préparer, livrer et facturer vos commandes.',
      'Vous contacter au sujet d’une commande (appel, SMS, WhatsApp, notifications du site).',
      'Gérer votre compte, vos adresses, vos favoris et votre programme de fidélité ou de parrainage.',
      'Assurer le service client et prévenir les abus ou la fraude.',
      'Établir des statistiques internes pour améliorer notre service.',
    ],
  },
  {
    title: 'Qui peut accéder à vos données ?',
    paragraphs: [
      'Les données sont accessibles à l’équipe de Fresh Fish. Les livreurs voient uniquement ce qui est nécessaire à la livraison (nom, téléphone, adresse, contenu de la commande).',
      'Selon votre choix de paiement, l’opérateur concerné (MTN ou Orange) traite votre paiement Mobile Money. Nos prestataires techniques (hébergement, envoi de SMS) interviennent pour faire fonctionner le service ; la connexion Google est régie par la politique de Google ; les cartes affichées proviennent d’OpenStreetMap.',
      'Nous ne vendons pas vos données.',
    ],
  },
  {
    title: 'Combien de temps les conservons-nous ?',
    paragraphs: [
      'Vos données sont conservées pendant la durée de votre relation avec Fresh Fish, puis le temps nécessaire pour respecter nos obligations légales (notamment de facturation et de comptabilité).',
    ],
  },
  {
    title: 'Comment protégeons-nous vos données ?',
    paragraphs: [
      'Les mots de passe sont chiffrés, les échanges avec le site sont protégés (HTTPS) et l’accès aux informations est limité selon le rôle de chacun (client, livreur, administrateur).',
    ],
  },
  {
    title: 'Vos droits',
    paragraphs: [
      'Vous pouvez consulter et corriger vos informations depuis votre compte (profil et adresses). Vous pouvez aussi nous demander l’accès à vos données, leur correction, leur suppression ou vous opposer à un usage particulier en nous contactant.',
    ],
  },
  {
    title: 'Stockage dans votre navigateur',
    paragraphs: [
      'Le site utilise le stockage de votre navigateur pour fonctionner : contenu du panier, session de connexion (conservée si vous cochez « Se souvenir de moi », sinon effacée à la fermeture) et petites préférences d’affichage. Nous n’utilisons pas de cookies publicitaires.',
    ],
  },
  {
    title: 'Modifications',
    paragraphs: ['Cette politique peut évoluer. La date de dernière mise à jour figure en haut de la page.'],
  },
  {
    title: 'Contact',
    paragraphs: [`${COMPANY_NAME} — ${COMPANY_ADDRESS}`, `Téléphone : ${COMPANY_PHONE_DISPLAY} · WhatsApp : ${WHATSAPP_NUMBER_DISPLAY}`],
  },
];

export default function Privacy() {
  usePageMeta('Politique de confidentialité', 'Comment Fresh Fish collecte, utilise et protège vos données personnelles.');
  return (
    <LegalLayout
      title="Politique de confidentialité"
      updated="novembre 2026"
      intro="Vos données servent à une seule chose : vous livrer de bons produits. Voici, simplement, ce que nous collectons, pourquoi, et comment vous gardez la main."
      sections={SECTIONS}
      otherLink={{ to: '/conditions-generales', label: "Conditions générales d'utilisation et de vente" }}
    />
  );
}
