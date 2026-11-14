import { Link } from 'react-router-dom';
import { Phone, MapPin, MessageCircle } from 'lucide-react';
import PaymentLogos from './PaymentLogos';
import {
  COMPANY_NAME,
  COMPANY_SUBTAGLINE,
  COMPANY_PHONE_DISPLAY,
  WHATSAPP_NUMBER_DISPLAY,
  COMPANY_ADDRESS,
} from '../config';

export default function Footer() {
  return (
    <footer className="mt-16 bg-pine-950 text-white/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white p-1">
              <img src="/brand/logo-icon-raw.png" alt="" className="h-full w-full object-contain" />
            </span>
            <span className="font-display text-lg font-bold text-white">{COMPANY_NAME}</span>
          </div>
          <p className="mt-3 text-sm italic text-white/50">{COMPANY_SUBTAGLINE}</p>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-wide text-white/40">Contact</h4>
          <ul className="mt-3 space-y-2.5 text-sm">
            <li className="flex items-center gap-2">
              <Phone size={15} className="text-brand-500" /> {COMPANY_PHONE_DISPLAY}
            </li>
            <li className="flex items-center gap-2">
              <MessageCircle size={15} className="text-brand-500" /> {WHATSAPP_NUMBER_DISPLAY} (WhatsApp)
            </li>
            <li className="flex items-center gap-2">
              <MapPin size={15} className="text-brand-500" /> {COMPANY_ADDRESS}
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-wide text-white/40">Livraison</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li>Partout à Yaoundé</li>
            <li>1 000 FCFA, quelle que soit la distance</li>
            <li>
              <Link to="/livraison" className="text-brand-500 hover:underline">Détails de la livraison →</Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-wide text-white/40">Paiement</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><PaymentLogos className="h-10 w-10" /></li>
            <li>MTN Mobile Money · Orange Money</li>
            <li className="text-white/50">Espèces à la livraison pour les clients fidèles avec compte</li>
          </ul>
          <nav className="mt-5 flex flex-col gap-1.5 text-sm text-white/50">
            <Link to="/a-propos" className="hover:text-white">À propos</Link>
            <Link to="/#comment-ca-marche" className="hover:text-white">Comment ça marche</Link>
            <Link to="/suivi-commande" className="hover:text-white">Suivre ma commande</Link>
            <Link to="/contact" className="hover:text-white">Contact</Link>
          </nav>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-white/40 sm:px-6">
        <p>© {new Date().getFullYear()} {COMPANY_NAME} — Silures frais & alevins livrés à Yaoundé.</p>
        <p className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1">
          <Link to="/conditions-generales" className="hover:text-white">Conditions générales</Link>
          <Link to="/confidentialite" className="hover:text-white">Politique de confidentialité</Link>
          <Link to="/suppression-compte" className="hover:text-white">Supprimer mon compte</Link>
        </p>
      </div>
    </footer>
  );
}
