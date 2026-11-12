import { MessageCircle } from 'lucide-react';
import { WHATSAPP_NUMBER } from '../config';

// `raised` : sur mobile, le bouton passe au-dessus de la barre de navigation du bas (h-16).
export default function WhatsAppButton({ message = 'Bonjour Fresh Fish, je souhaite passer une commande.', raised = false }) {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`fixed right-4 z-40 flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3.5 font-display text-sm font-semibold text-white shadow-lg shadow-brand-900/20 transition hover:bg-brand-700 sm:right-5 sm:px-5 ${
        raised ? 'bottom-20 lg:bottom-5' : 'bottom-5'
      }`}
      aria-label="Contacter sur WhatsApp"
    >
      <MessageCircle size={20} />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
