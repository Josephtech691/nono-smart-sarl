import { MessageCircle } from 'lucide-react';
import { WHATSAPP_NUMBER } from '../config';

export default function WhatsAppButton({ message = 'Bonjour NONO SMART, je souhaite passer une commande.' }) {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3.5 font-display text-sm font-semibold text-white shadow-lg shadow-brand-900/20 transition hover:bg-brand-700 sm:px-5"
      aria-label="Contacter sur WhatsApp"
    >
      <MessageCircle size={20} />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
