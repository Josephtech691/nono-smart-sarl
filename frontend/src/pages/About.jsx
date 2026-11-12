import { Link } from 'react-router-dom';
import {
  Droplets, BadgeCheck, ShieldCheck, ArrowRight, Phone, MessageCircle, MapPin, Briefcase, Repeat, Navigation, BadgePercent,
} from 'lucide-react';
import PageHero from '../components/PageHero';
import {
  COMPANY_NAME,
  COMPANY_TAGLINE,
  COMPANY_SUBTAGLINE,
  COMPANY_PHONE,
  COMPANY_PHONE_DISPLAY,
  WHATSAPP_NUMBER,
  WHATSAPP_NUMBER_DISPLAY,
  COMPANY_ADDRESS,
} from '../config';

const VALUES = [
  { icon: Droplets, title: 'Fraîcheur', text: "Nos silures arrivent du bassin jusqu'à votre porte, sans détour : c'est la base de tout ce que nous faisons." },
  { icon: BadgeCheck, title: 'Qualité', text: 'Des poissons sains et soigneusement préparés, et des alevins pensés pour les pisciculteurs qui démarrent ou agrandissent leur élevage.' },
  { icon: ShieldCheck, title: 'Confiance', text: 'Des prix clairs affichés avant de commander, un paiement sécurisé et un suivi de commande de bout en bout.' },
];

const OFFERS = [
  {
    title: 'Silures frais',
    text: 'Pour la table familiale, la restauration ou la revente : commandez la quantité dont vous avez besoin, le prix baisse à mesure que la quantité augmente.',
    image: '/products/silure-2.jpg',
    to: '/produits?category=silures-frais',
  },
  {
    title: 'Alevins de silure',
    text: "Pour les pisciculteurs : des alevins en lots, avec la possibilité de programmer la livraison à la date et au créneau qui vous arrangent.",
    image: '/products/alevins-1.jpg',
    to: '/produits?category=alevins',
  },
];

const SERVICES = [
  { icon: BadgePercent, title: 'Prix dégressifs', text: 'Plus vous commandez, moins le kilo est cher.' },
  { icon: Navigation, title: 'Suivi en direct', text: 'Suivez votre commande et la position du livreur.' },
  { icon: Repeat, title: 'Commandes récurrentes', text: 'Recevez automatiquement votre commande chaque semaine ou chaque mois.' },
  { icon: Briefcase, title: 'Comptes professionnels', text: 'Restaurateurs et revendeurs : bénéficiez de tarifs grossistes après validation de votre compte.' },
];

export default function About() {
  return (
    <div>
      <PageHero
        eyebrow={COMPANY_SUBTAGLINE}
        title={`Qui est ${COMPANY_NAME} ?`}
        subtitle="Une entreprise de Yaoundé spécialisée dans le silure : poisson frais pour la table et alevins pour l'élevage, commandés en ligne et livrés chez vous."
        image="/products/hero-silure.jpg"
        imageAlt="Silures frais"
      >
        <Link to="/produits" className="btn-primary">
          Voir nos produits <ArrowRight size={17} />
        </Link>
        <Link to="/livraison" className="btn-outline-white">Zones de livraison</Link>
      </PageHero>

      {/* Valeurs */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">{COMPANY_TAGLINE}</p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Notre promesse, en trois mots</h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {VALUES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-700">
                <Icon size={22} />
              </span>
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/60">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Offres */}
      <section className="bg-mist/70 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Ce que nous proposons</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {OFFERS.map((o) => (
              <Link key={o.title} to={o.to} className="card group overflow-hidden transition hover:-translate-y-0.5">
                <img src={o.image} alt={o.title} className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" />
                <div className="p-6">
                  <h3 className="text-xl font-bold">{o.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/60">{o.text}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                    Découvrir <ArrowRight size={15} className="transition group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">Pensé pour vous simplifier la vie</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4 rounded-xl2 border border-line bg-white p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pine-900 text-brand-500">
                <Icon size={18} />
              </span>
              <div>
                <h3 className="font-display text-base font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-ink/60">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
        <div className="overflow-hidden rounded-xl2 bg-pine-900 px-6 py-10 text-center text-white sm:px-12">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Une question ? Parlons-en.</h2>
          <p className="mx-auto mt-2 max-w-xl text-white/65">
            Besoin d'un devis pour une grosse quantité, d'un conseil pour vos alevins ou d'un renseignement sur la livraison ? Notre équipe vous répond.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href={`tel:+237${COMPANY_PHONE}`} className="btn-primary">
              <Phone size={17} /> {COMPANY_PHONE_DISPLAY}
            </a>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" className="btn-outline-white">
              <MessageCircle size={17} /> WhatsApp {WHATSAPP_NUMBER_DISPLAY}
            </a>
          </div>
          <p className="mt-5 flex items-center justify-center gap-2 text-sm text-white/55">
            <MapPin size={15} className="text-brand-500" /> {COMPANY_ADDRESS}
          </p>
        </div>
      </section>
    </div>
  );
}
