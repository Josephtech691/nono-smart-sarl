import { Link } from 'react-router-dom';
import {
  MapPin, CalendarClock, Navigation, KeyRound, ChevronDown, ArrowRight, Truck, Wallet,
} from 'lucide-react';
import PageHero from '../components/PageHero';
import { formatFCFA } from '../utils/format';
import { COMPANY_CITY, FLAT_DELIVERY_FEE } from '../config';
import { PaymentLogo } from '../components/PaymentLogos';

const STEPS = [
  { icon: MapPin, title: 'Vous indiquez votre adresse', text: 'Sur la carte, avec le GPS ou à la main, avec votre quartier : les frais de livraison (un tarif unique) s\'affichent avant de valider.' },
  { icon: CalendarClock, title: 'Immédiate ou programmée', text: 'Livraison dès que possible, ou à la date et au créneau de votre choix. Pratique pour les alevins.' },
  { icon: Navigation, title: 'Vous suivez en direct', text: 'L\'avancement de la commande et la position du livreur sont visibles sur la carte pendant la livraison.' },
  { icon: KeyRound, title: 'Vous confirmez avec un code', text: 'Donnez au livreur le code à 4 chiffres reçu avec votre commande : c\'est la preuve de remise.' },
];

const PAYMENTS = [
  { label: 'MTN Mobile Money', method: 'MTN_MOMO', text: 'Validez la demande reçue sur votre téléphone avec votre code PIN.' },
  { label: 'Orange Money', method: 'ORANGE_MONEY', text: 'Vous êtes redirigé vers Orange Money pour valider le paiement.' },
  { label: 'Espèces à la livraison', color: '#279C5A', text: 'Réservé aux clients avec compte ayant déjà payé plus de 2 commandes par Mobile Money.' },
];

const FAQ = [
  { q: 'Comment sont calculés les frais de livraison ?', a: 'C\'est un tarif unique de 1 000 FCFA par commande, quels que soient votre quartier et la distance. Il apparaît dans le récapitulatif, avant que vous ne validiez votre commande.' },
  { q: 'Puis-je programmer ma livraison ?', a: 'Oui. Au moment de commander, choisissez « Livraison programmée », puis la date, la plage horaire et vos instructions éventuelles.' },
  { q: 'Comment suivre ma commande ?', a: 'Depuis votre compte, ou sans compte via « Suivre ma commande » avec votre numéro de commande et votre téléphone. Quand le livreur est en route, sa position s\'affiche sur la carte.' },
  { q: 'À quoi sert le code de confirmation ?', a: 'Il vous est communiqué avec votre commande. Le livreur vous le demande à la remise : cela confirme que vous avez bien reçu vos produits.' },
  { q: 'Et si le livreur n\'arrive pas à me joindre ?', a: 'Il signale la situation à notre équipe, qui prend le relais pour convenir d\'une nouvelle tentative. Gardez votre téléphone à portée de main pendant la livraison.' },
  { q: 'Livrez-vous en dehors de Yaoundé ?', a: 'Pour l\'instant, la livraison est assurée à Yaoundé. D\'autres villes pourront être ajoutées plus tard.' },
];

export default function Delivery() {
  return (
    <div>
      <PageHero
        eyebrow={`Livraison à ${COMPANY_CITY}`}
        title="Du bassin à votre porte"
        subtitle="Commandez en ligne, choisissez votre créneau et suivez votre livreur. Un seul tarif de livraison, partout."
        image="/products/silure-3.jpg"
        imageAlt="Silures prêts à être livrés"
      >
        <Link to="/produits" className="btn-primary">
          Commander <ArrowRight size={17} />
        </Link>
        <Link to="/suivi-commande" className="btn-outline-white">Suivre ma commande</Link>
      </PageHero>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold sm:text-3xl">Un tarif unique</h2>
            <p className="mt-3 text-ink/60">
              Nous livrons partout à {COMPANY_CITY}. Les frais sont les mêmes pour tous les quartiers et ajoutés automatiquement à votre commande.
            </p>
          </div>
          <div className="lg:col-span-3">
            <div className="flex items-center gap-4 rounded-xl2 border border-line bg-white p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pine-900 text-brand-500"><Truck size={22} /></span>
              <div>
                <p className="font-display text-3xl font-bold text-ink">{formatFCFA(FLAT_DELIVERY_FEE)}</p>
                <p className="text-sm text-ink/60">par commande, quelle que soit la distance</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-mist/70 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Comment se passe la livraison ?</h2>
          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="card relative p-6">
                <span className="absolute right-5 top-4 font-display text-4xl font-extrabold text-ink/[0.06]">{i + 1}</span>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-pine-900 text-brand-500">
                  <Icon size={19} />
                </span>
                <h3 className="mt-4 font-display text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex items-center justify-center gap-2">
          <Wallet size={20} className="text-brand-600" />
          <h2 className="text-2xl font-bold sm:text-3xl">Payez comme vous voulez</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PAYMENTS.map((p) => (
            <div key={p.label} className="rounded-xl2 border border-line bg-white p-5">
              <p className="flex items-center gap-2.5 font-display font-semibold text-ink">
                {p.method ? <PaymentLogo method={p.method} className="h-8 w-8" /> : <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: p.color }} aria-hidden="true" />} {p.label}
              </p>
              <p className="mt-2 text-sm text-ink/60">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-8 sm:px-6">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">Questions fréquentes</h2>
        <div className="mt-8 space-y-3">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group card px-5 py-4 open:shadow-md">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown size={18} className="shrink-0 text-ink/40 transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink/60">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
