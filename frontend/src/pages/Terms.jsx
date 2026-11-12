import LegalLayout from '../components/LegalLayout';
import usePageMeta from '../utils/usePageMeta';
import { COMPANY_NAME, COMPANY_ADDRESS, COMPANY_PHONE_DISPLAY, WHATSAPP_NUMBER_DISPLAY } from '../config';

const SECTIONS = [
  {
    title: 'Objet',
    paragraphs: [
      `Les présentes conditions régissent l'utilisation du site de ${COMPANY_NAME} et les commandes de silures frais et d'alevins de silure passées en ligne, avec livraison à Yaoundé.`,
      'Utiliser le site ou passer commande implique l’acceptation de ces conditions.',
    ],
  },
  {
    title: 'Produits et disponibilité',
    paragraphs: [
      'Nos produits sont frais, vivants (alevins) ou périssables (silures frais). Les photos sont indicatives.',
      'Les quantités disponibles sont limitées et mises à jour en continu : un produit peut devenir indisponible entre l’ajout au panier et la validation de la commande. Des quantités minimales de vente peuvent s’appliquer ; elles sont indiquées sur chaque fiche produit.',
    ],
  },
  {
    title: 'Prix',
    paragraphs: [
      'Les prix sont affichés en francs CFA (FCFA). Certains produits bénéficient de prix dégressifs : le prix unitaire baisse lorsque la quantité commandée atteint un palier indiqué sur la fiche produit.',
      'Les clients professionnels dont le compte a été validé peuvent bénéficier d’un tarif préférentiel. Les frais de livraison sont de 1 000 FCFA par commande, quelle que soit la distance ; ils sont affichés avant la validation de la commande.',
      'Le prix applicable est celui affiché au moment de la validation de la commande.',
    ],
  },
  {
    title: 'Commande',
    paragraphs: [
      'Vous pouvez commander avec ou sans compte client. Après validation, un numéro de commande vous est attribué ; il vous permet de suivre votre commande depuis la page « Suivre ma commande ».',
      `${COMPANY_NAME} peut vous contacter pour confirmer une commande ou proposer une alternative en cas d’indisponibilité. Nous pouvons refuser ou annuler une commande en cas d’adresse de livraison inexploitable ou de problème sur la commande.`,
    ],
  },
  {
    title: 'Paiement',
    paragraphs: [
      'Deux moyens de paiement sont proposés : MTN Mobile Money (vous validez la demande de paiement reçue sur votre téléphone) et Orange Money (vous validez le paiement sur la page Orange Money). Le paiement en espèces à la livraison est réservé aux clients ayant un compte et ayant déjà payé plus de 2 commandes par Mobile Money.',
      'Si la demande de paiement Mobile Money n’aboutit pas, vous pouvez la relancer depuis la page de confirmation de commande ou depuis votre compte. Une facture au format PDF est disponible pour chaque commande.',
    ],
  },
  {
    title: 'Livraison',
    paragraphs: [
      'La livraison est assurée à Yaoundé, au tarif unique indiqué sur la page « Livraison ». Vous pouvez demander une livraison dès que possible ou programmer un jour et un créneau.',
      'À la réception, le livreur vous demande un code de confirmation à 4 chiffres, visible dans le suivi de votre commande. Merci d’être joignable au numéro indiqué : en cas d’absence ou de numéro injoignable, la livraison pourra être reportée.',
    ],
  },
  {
    title: 'Réception et réclamations',
    paragraphs: [
      'Vérifiez votre commande à la réception, en présence du livreur. En cas de problème (produit non conforme, quantité manquante, qualité insatisfaisante), signalez-le immédiatement au livreur ou contactez-nous le jour même par téléphone ou WhatsApp, afin que nous puissions traiter votre demande rapidement.',
    ],
  },
  {
    title: 'Annulation et retours',
    paragraphs: [
      'Une commande peut être annulée depuis votre compte tant qu’elle n’est pas en préparation (statuts « En attente » ou « Confirmée »). Ensuite, contactez-nous : nous verrons avec vous ce qui est possible.',
      'Les produits étant frais, vivants ou périssables, ils ne peuvent être ni repris ni échangés, sauf en cas de défaut constaté à la livraison.',
    ],
  },
  {
    title: 'Compte client',
    paragraphs: [
      'Vous êtes responsable de la confidentialité de votre mot de passe et des informations fournies, qui doivent être exactes. Pour une commande, un numéro de téléphone joignable est indispensable.',
      `${COMPANY_NAME} peut suspendre un compte en cas d’usage abusif du site.`,
    ],
  },
  {
    title: 'Données personnelles',
    paragraphs: ['Le traitement de vos données personnelles est décrit dans notre politique de confidentialité.'],
  },
  {
    title: 'Droit applicable et litiges',
    paragraphs: [
      'Les présentes conditions sont soumises au droit applicable au Cameroun. En cas de difficulté, nous vous invitons à nous contacter en priorité afin de trouver une solution amiable.',
    ],
  },
  {
    title: 'Contact',
    paragraphs: [`${COMPANY_NAME} — ${COMPANY_ADDRESS}`, `Téléphone : ${COMPANY_PHONE_DISPLAY} · WhatsApp : ${WHATSAPP_NUMBER_DISPLAY}`],
  },
];

export default function Terms() {
  usePageMeta("Conditions générales d'utilisation et de vente", "Conditions d'utilisation du site et de vente de silures frais et d'alevins Fresh Fish à Yaoundé.");
  return (
    <LegalLayout
      title="Conditions générales d'utilisation et de vente"
      updated="novembre 2026"
      intro={`Bienvenue chez ${COMPANY_NAME}. Merci de lire ces conditions avant de commander : elles expliquent comment fonctionnent les commandes, le paiement et la livraison.`}
      sections={SECTIONS}
      otherLink={{ to: '/confidentialite', label: 'Politique de confidentialité' }}
    />
  );
}
