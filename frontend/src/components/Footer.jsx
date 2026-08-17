import { Link } from 'react-router-dom';
import { Fish, Phone, MapPin, MessageCircle } from 'lucide-react';
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
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <Fish size={18} />
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
            <li>Essos · Centre-ville · Bastos</li>
            <li>Odza · Nkolbisson</li>
            <li className="text-white/50">Zones et frais à Yaoundé, extension à venir</li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-wide text-white/40">Paiement</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li>MTN Mobile Money</li>
            <li>Orange Money</li>
            <li>Espèces à la livraison</li>
          </ul>
          <nav className="mt-5 flex flex-col gap-1.5 text-sm text-white/50">
            <Link to="/admin/connexion" className="hover:text-white">Espace administration</Link>
            <Link to="/livreur/connexion" className="hover:text-white">Espace livreur</Link>
          </nav>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-white/40 sm:px-6">
        © {new Date().getFullYear()} {COMPANY_NAME} — Silures frais & alevins livrés à Yaoundé.
      </div>
    </footer>
  );
}
