import { MessageCircle } from 'lucide-react';
import { WHATSAPP_NUMBER } from '../config';

/**
 * Encart "Besoin d'aide ?" -> WhatsApp avec le numero de commande deja ecrit
 * dans le message (maquette : ecran de suivi de commande).
 */
export default function NeedHelp({ orderNumber, className = '' }) {
  const text = orderNumber
    ? `Bonjour Fresh Fish, j'ai besoin d'aide pour ma commande ${orderNumber}.`
    : "Bonjour Fresh Fish, j'ai besoin d'aide.";
  return (
    <div className={`flex items-center gap-4 rounded-xl2 border border-line bg-white p-4 ${className}`}>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold text-ink">Besoin d'aide ?</p>
        <p className="text-xs text-ink/55">Contactez-nous sur WhatsApp, nous vous répondons.</p>
      </div>
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Ouvrir WhatsApp"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700"
      >
        <MessageCircle size={20} />
      </a>
    </div>
  );
}
