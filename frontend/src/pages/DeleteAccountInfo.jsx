import { Link } from 'react-router-dom';
import usePageMeta from '../utils/usePageMeta';
import { COMPANY_PHONE_DISPLAY, WHATSAPP_NUMBER_DISPLAY } from '../config';

/** Page publique expliquant comment supprimer son compte (adresse demandée par Google Play). */
export default function DeleteAccountInfo() {
  usePageMeta('Suppression de compte');
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">Suppression de votre compte</h1>
      <p className="mt-4 text-ink/75">Vous pouvez supprimer votre compte Fresh Fish à tout moment.</p>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Depuis l'application ou le site</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-ink/75">
          <li><Link to="/connexion" className="font-medium text-brand-700 hover:underline">Connectez-vous</Link> à votre compte.</li>
          <li>Ouvrez <strong>Mon compte</strong>, puis <strong>Mon profil</strong>.</li>
          <li>En bas de la page, choisissez <strong>Supprimer mon compte</strong> et confirmez.</li>
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Vous n'arrivez pas à vous connecter ?</h2>
        <p className="mt-2 text-ink/75">
          Contactez-nous par téléphone au {COMPANY_PHONE_DISPLAY} ou par WhatsApp au {WHATSAPP_NUMBER_DISPLAY}, en indiquant le numéro de téléphone du compte : nous le supprimerons après vérification de votre identité.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Ce qui est supprimé</h2>
        <p className="mt-2 text-ink/75">
          Votre nom, téléphone, e-mail, mot de passe, adresses, favoris, commandes récurrentes, notifications et points de fidélité sont effacés. Vos commandes passées sont conservées de façon anonyme (sans lien avec vous), car la loi nous oblige à garder les pièces comptables.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Condition</h2>
        <p className="mt-2 text-ink/75">Aucune commande ne doit être en cours : attendez sa livraison ou annulez-la avant de supprimer votre compte.</p>
      </section>
    </div>
  );
}
