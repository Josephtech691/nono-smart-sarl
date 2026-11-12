import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, MapPin, Heart, Repeat, Star, Gift, User, Briefcase,
  Award, Truck, CheckCircle2, AlertTriangle, ArrowRight, PackageSearch,
} from 'lucide-react';
import { ordersApi } from '../../api/orders';
import { useAuthStore } from '../../store/authStore';
import AccountBack from '../../components/AccountBack';
import StatusBadge from '../../components/StatusBadge';
import PaymentBadge from '../../components/PaymentBadge';
import EmptyState from '../../components/EmptyState';
import usePageMeta from '../../utils/usePageMeta';
import { formatFCFA, formatDate } from '../../utils/format';

const PENDING_PREFIX = 'google-pending-';
const FINAL_STATUSES = ['DELIVERED', 'CANCELLED'];

const SHORTCUTS = [
  { to: '/compte/commandes', label: 'Mes commandes', hint: 'Suivi et historique', icon: Package },
  { to: '/compte/adresses', label: 'Mes adresses', hint: 'Livraison en un clic', icon: MapPin },
  { to: '/compte/favoris', label: 'Mes favoris', hint: 'Vos produits préférés', icon: Heart },
  { to: '/compte/commandes-recurrentes', label: 'Commandes récurrentes', hint: 'Livraison automatique', icon: Repeat },
  { to: '/compte/avis', label: 'Mes avis', hint: 'Notez vos livraisons', icon: Star },
  { to: '/compte/parrainage', label: 'Parrainage', hint: '50 points par ami parrainé', icon: Gift },
  { to: '/compte/profil', label: 'Mon profil', hint: 'Infos et mot de passe', icon: User },
  { to: '/compte/professionnel', label: 'Compte professionnel', hint: 'Remises grossiste', icon: Briefcase },
];

function StatTile({ to, icon: Icon, label, value, tone }) {
  const tones = {
    amber: 'bg-amber-100 text-amber-700',
    brand: 'bg-brand-500/15 text-brand-700',
    pine: 'bg-pine-900 text-brand-500',
  };
  return (
    <Link to={to} className="card flex flex-col gap-2 p-4 transition hover:border-brand-500/50 sm:p-5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-full sm:h-10 sm:w-10 ${tones[tone] || tones.brand}`}>
        <Icon size={18} />
      </span>
      <span className="font-display text-2xl font-bold leading-none text-ink sm:text-3xl" data-testid={`stat-${tone}`}>{value}</span>
      <span className="text-xs text-ink/55 sm:text-sm">{label}</span>
    </Link>
  );
}

export default function AccountDashboard() {
  usePageMeta('Mon compte');
  const user = useAuthStore((s) => s.user);
  const [orders, setOrders] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let ignore = false;
    ordersApi
      .list({ limit: 100 })
      .then((r) => !ignore && setOrders(r.items || []))
      .catch(() => {
        if (ignore) return;
        setOrders([]);
        setLoadFailed(true);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const { active, delivered, toReview, featured } = useMemo(() => {
    const list = orders || [];
    const activeOrders = list.filter((o) => !FINAL_STATUSES.includes(o.status));
    const deliveredOrders = list.filter((o) => o.status === 'DELIVERED');
    return {
      active: activeOrders,
      delivered: deliveredOrders,
      toReview: deliveredOrders.filter((o) => !o.review),
      // On met en avant la commande en cours la plus récente, sinon la dernière commande.
      featured: activeOrders[0] || list[0] || null,
    };
  }, [orders]);

  const needsPhone = !!user?.needsProfileCompletion || String(user?.phone || '').startsWith(PENDING_PREFIX);
  const points = user?.customerProfile?.loyaltyPoints ?? 0;
  const featuredIsActive = featured && !FINAL_STATUSES.includes(featured.status);
  const itemNames = featured
    ? `${(featured.items || []).slice(0, 2).map((i) => i.name).join(', ')}${(featured.items || []).length > 2 ? '…' : ''}`
    : '';

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Bonjour, {user?.firstName || 'bienvenue'}</h1>
      <p className="mt-1 text-sm text-ink/60">Retrouvez vos commandes, vos adresses et vos avantages.</p>
      <AccountBack />

      {needsPhone && (
        <Link
          to="/compte/profil"
          role="alert"
          className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 transition hover:bg-amber-100"
        >
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <span className="flex-1">
            <strong>Complétez votre profil :</strong> ajoutez votre numéro de téléphone pour que le livreur puisse vous joindre.
          </span>
          <ArrowRight size={18} className="mt-0.5 shrink-0" />
        </Link>
      )}

      {/* Chiffres clés */}
      {orders === null ? (
        <div className="grid grid-cols-3 gap-3 sm:gap-4" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-28 rounded-xl2" />
          ))}
        </div>
      ) : loadFailed ? null : (
        // En cas d'erreur serveur on n'affiche pas de faux « 0 » : seul le message d'erreur est montré.
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <StatTile to="/compte/commandes?filtre=en-cours" icon={Truck} tone="amber" label="Commandes en cours" value={active.length} />
          <StatTile to="/compte/commandes?filtre=livrees" icon={CheckCircle2} tone="brand" label="Commandes livrées" value={delivered.length} />
          <StatTile to="/compte/profil" icon={Award} tone="pine" label="Points fidélité" value={points} />
        </div>
      )}

      {loadFailed && (
        <p role="status" className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Impossible de charger vos commandes pour le moment. Réessayez dans un instant.
        </p>
      )}

      {/* Commande à suivre */}
      {orders !== null && !loadFailed && (
        <section className="mt-6" aria-labelledby="last-order-title">
          {featured ? (
            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="last-order-title" className="font-display text-lg font-semibold">
                  {featuredIsActive ? 'Commande en cours' : 'Dernière commande'}
                </h2>
                <StatusBadge status={featured.status} />
              </div>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 text-sm text-ink/65">
                  <p className="font-display text-base font-semibold text-ink">{featured.orderNumber}</p>
                  <p className="mt-0.5">{formatDate(featured.createdAt)}</p>
                  {itemNames && <p className="mt-0.5 truncate">{itemNames}</p>}
                  <p className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-display font-bold text-ink">{formatFCFA(featured.total)}</span>
                    {featured.status !== 'CANCELLED' && featured.payment && (
                      <PaymentBadge status={featured.payment.status} method={featured.payment.method} />
                    )}
                  </p>
                </div>
                <Link to={`/compte/commandes/${featured.id}`} className="btn-primary shrink-0">
                  {featuredIsActive ? 'Suivre ma commande' : 'Voir le détail'} <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="Vous n'avez pas encore commandé"
              description="Silures frais et alevins livrés chez vous à Yaoundé."
              action={<Link to="/produits" className="btn-primary mt-2">Voir les produits</Link>}
            />
          )}
        </section>
      )}

      {/* Invitation à noter */}
      {toReview.length > 0 && (
        <Link
          to={toReview.length === 1 ? `/compte/commandes/${toReview[0].id}` : '/compte/avis'}
          className="mt-4 flex items-center gap-3 rounded-xl2 border border-brand-500/30 bg-brand-500/10 p-4 text-sm text-ink transition hover:bg-brand-500/15"
        >
          <Star size={20} className="shrink-0 text-amber-500" />
          <span className="flex-1">
            <strong>Votre avis compte.</strong>{' '}
            {toReview.length === 1 ? 'Une livraison attend votre note.' : `${toReview.length} livraisons attendent votre note.`}
          </span>
          <ArrowRight size={18} className="shrink-0 text-brand-700" />
        </Link>
      )}

      {/* Raccourcis */}
      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Mon espace</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SHORTCUTS.map(({ to, label, hint, icon: Icon }) => (
          <Link key={to} to={to} className="card flex items-center gap-3 p-4 transition hover:border-brand-500/50">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mist text-brand-700">
              <Icon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{label}</span>
              <span className="block truncate text-xs text-ink/50">{hint}</span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-ink/30" />
          </Link>
        ))}
      </div>
    </div>
  );
}
