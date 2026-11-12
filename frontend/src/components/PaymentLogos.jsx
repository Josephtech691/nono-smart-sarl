// Logos des moyens de paiement mobile (fichiers dans /public/payment).
export const PAYMENT_LOGOS = {
  MTN_MOMO: { src: '/payment/mtn-momo.png', alt: 'MTN Mobile Money' },
  ORANGE_MONEY: { src: '/payment/orange-money.png', alt: 'Orange Money' },
};

export function PaymentLogo({ method, className = 'h-10 w-10' }) {
  const logo = PAYMENT_LOGOS[method];
  if (!logo) return null;
  return <img src={logo.src} alt={logo.alt} className={`${className} rounded-lg object-contain`} loading="lazy" />;
}

export default function PaymentLogos({ className = 'h-9 w-9' }) {
  return (
    <span className="flex items-center gap-2">
      <PaymentLogo method="MTN_MOMO" className={className} />
      <PaymentLogo method="ORANGE_MONEY" className={className} />
    </span>
  );
}
