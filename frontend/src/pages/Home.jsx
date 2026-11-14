import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Phone,
  MessageCircle,
  MapPin,
  Truck,
  ShieldCheck,
  Wallet,
  Headphones,
  BadgePercent,
} from 'lucide-react';
import { productsApi } from '../api/catalog';
import ProductCard from '../components/ProductCard';
import Loader from '../components/Loader';
import {
  COMPANY_PHONE_DISPLAY,
  WHATSAPP_NUMBER_DISPLAY,
  COMPANY_ADDRESS,
  COMPANY_SUBTAGLINE,
} from '../config';

const FEATURES = [
  { icon: Truck, title: 'Livraison rapide', text: 'Partout à Yaoundé' },
  { icon: ShieldCheck, title: 'Produits frais', text: 'Qualité garantie' },
  { icon: Wallet, title: 'Paiement sécurisé', text: 'MTN MoMo ou Orange Money' },
  { icon: Headphones, title: 'Service client', text: 'À votre écoute' },
  { icon: BadgePercent, title: 'Prix dégressifs', text: 'Plus vous achetez, moins vous payez' },
];

const STEPS = [
  { n: 1, title: 'Choisissez', text: "Silures frais ou alevins, la quantité qu'il vous faut." },
  { n: 2, title: 'Commandez', text: 'En ligne, avec ou sans compte.' },
  { n: 3, title: 'Payez', text: 'MTN MoMo ou Orange Money, en toute sécurité.' },
  { n: 4, title: 'Nous préparons', text: 'Votre commande est préparée avec soin.' },
  { n: 5, title: 'Nous livrons', text: 'Directement chez vous, à Yaoundé.' },
];

export default function Home() {
  const [products, setProducts] = useState(null);

  useEffect(() => {
    productsApi
      .list({ limit: 4 })
      .then((data) => setProducts(data.items))
      .catch(() => setProducts([]));
  }, []);

  return (
    <div>
      {/* HERO : bloc compact, la photo est visible en arrière-plan ; les produits suivent directement. */}
      <section className="relative overflow-hidden bg-pine-900">
        <img
          src="/products/hero-silure.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-pine-900/90 via-pine-900/65 to-pine-900/25" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 md:pb-16 md:pt-12">
          <div className="max-w-xl">
            <p className="mb-3 inline-block rounded-full bg-black/30 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-500 backdrop-blur-sm">
              {COMPANY_SUBTAGLINE}
            </p>
            <h1 className="font-display text-3xl font-extrabold leading-[1.1] text-white drop-shadow sm:text-4xl">
              Silures frais &amp; alevins <span className="text-brand-500">livrés chez vous</span>
            </h1>
            <p className="mt-3 max-w-md text-sm text-white/85 sm:text-base">
              Des produits frais, sains et de qualité, livrés partout à Yaoundé.
            </p>
          </div>
        </div>

        {/* Ondulation signature - transition "du bassin" vers le contenu */}
        <svg viewBox="0 0 1440 90" className="wave-divider text-paper" preserveAspectRatio="none">
          <path
            fill="currentColor"
            d="M0,32 C240,80 480,0 720,24 C960,48 1200,88 1440,40 L1440,90 L0,90 Z"
          />
        </svg>
      </section>

      {/* PRODUITS POPULAIRES */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-bold sm:text-3xl">Nos produits populaires</h2>
          <Link to="/produits" className="hidden text-sm font-semibold text-brand-700 hover:underline sm:inline">
            Voir tout le catalogue →
          </Link>
        </div>
        {products === null ? (
          <Loader />
        ) : products.length === 0 ? (
          <p className="text-ink/60">Aucun produit disponible pour le moment.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* BARRE DE CONTACT RAPIDE */}
      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:grid-cols-3 sm:px-6">
          <a href={`tel:+237${COMPANY_PHONE_DISPLAY.replace(/\s/g, '')}`} className="flex items-center gap-3 rounded-xl2 p-2 transition hover:bg-mist">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500/10 text-brand-700"><Phone size={18} /></span>
            <div>
              <p className="text-xs text-ink/50">Téléphone</p>
              <p className="font-semibold text-ink">{COMPANY_PHONE_DISPLAY}</p>
            </div>
          </a>
          <div className="flex items-center gap-3 rounded-xl2 p-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500/10 text-brand-700"><MessageCircle size={18} /></span>
            <div>
              <p className="text-xs text-ink/50">WhatsApp</p>
              <p className="font-semibold text-ink">{WHATSAPP_NUMBER_DISPLAY}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl2 p-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500/10 text-brand-700"><MapPin size={18} /></span>
            <div>
              <p className="text-xs text-ink/50">Adresse</p>
              <p className="font-semibold text-ink">{COMPANY_ADDRESS}</p>
            </div>
          </div>
        </div>
      </section>


      {/* POURQUOI NOUS CHOISIR */}
      <section className="bg-mist py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">Pourquoi nous choisir ?</h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card flex flex-col items-center gap-2 p-5 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-700">
                  <Icon size={22} />
                </span>
                <p className="font-display text-sm font-semibold text-ink">{title}</p>
                <p className="text-xs text-ink/55">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMENT CA MARCHE */}
      <section id="comment-ca-marche" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
        <h2 className="mb-10 text-center text-2xl font-bold sm:text-3xl">Comment ça marche</h2>
        <div className="grid gap-6 sm:grid-cols-5">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative flex flex-col items-center text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pine-900 font-display text-lg font-bold text-white">
                {s.n}
              </span>
              <p className="mt-3 font-display text-sm font-semibold text-ink">{s.title}</p>
              <p className="mt-1 text-xs text-ink/55">{s.text}</p>
              {i < STEPS.length - 1 && (
                <span className="absolute right-[-1.1rem] top-6 hidden text-line sm:block">
                  <ArrowRight size={18} />
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="flex flex-col items-center gap-4 rounded-xl2 bg-brand-600 px-6 py-10 text-center text-white sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h3 className="font-display text-xl font-bold">Prêt à commander ?</h3>
            <p className="mt-1 text-sm text-white/85">Silures frais et alevins livrés chez vous, dès aujourd'hui.</p>
          </div>
          <Link to="/produits" className="btn-outline-white shrink-0">
            Voir les produits <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </div>
  );
}
