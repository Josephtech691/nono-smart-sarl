import { Phone, MessageCircle, MapPin, Clock } from 'lucide-react';
import { COMPANY_PHONE_DISPLAY, WHATSAPP_NUMBER, WHATSAPP_NUMBER_DISPLAY, COMPANY_ADDRESS } from '../config';

export default function Contact() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Contactez-nous</h1>
      <p className="mt-2 text-ink/60">Une question sur un produit, une commande ou une livraison ? Nous sommes disponibles.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <a href={`tel:+237${COMPANY_PHONE_DISPLAY.replace(/\s/g, '')}`} className="card flex items-center gap-4 p-5 transition hover:-translate-y-0.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-700"><Phone size={20} /></span>
          <div>
            <p className="text-xs text-ink/50">Appelez-nous</p>
            <p className="font-display font-semibold text-ink">{COMPANY_PHONE_DISPLAY}</p>
          </div>
        </a>
        <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" className="card flex items-center gap-4 p-5 transition hover:-translate-y-0.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-700"><MessageCircle size={20} /></span>
          <div>
            <p className="text-xs text-ink/50">WhatsApp</p>
            <p className="font-display font-semibold text-ink">{WHATSAPP_NUMBER_DISPLAY}</p>
          </div>
        </a>
        <div className="card flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-700"><MapPin size={20} /></span>
          <div>
            <p className="text-xs text-ink/50">Adresse</p>
            <p className="font-display font-semibold text-ink">{COMPANY_ADDRESS}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-700"><Clock size={20} /></span>
          <div>
            <p className="text-xs text-ink/50">Horaires</p>
            <p className="font-display font-semibold text-ink">Tous les jours, 7h – 19h</p>
          </div>
        </div>
      </div>
    </div>
  );
}
