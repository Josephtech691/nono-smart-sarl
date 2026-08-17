import { Award, Phone, Mail } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import AccountNav from '../../components/AccountNav';

export default function Profile() {
  const { user } = useAuthStore();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Mon compte</h1>
      <AccountNav />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display font-semibold text-ink">Informations</h2>
          <p className="mt-3 text-lg font-semibold text-ink">{user?.firstName} {user?.lastName}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-ink/60"><Phone size={14} /> {user?.phone}</p>
          {user?.email && <p className="mt-1 flex items-center gap-2 text-sm text-ink/60"><Mail size={14} /> {user.email}</p>}
        </div>

        <div className="card flex flex-col items-start justify-center bg-pine-900 p-5 text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <Award size={18} className="text-brand-500" />
          </span>
          <p className="mt-3 text-sm text-white/60">Points de fidélité</p>
          <p className="font-display text-3xl font-bold">{user?.customerProfile?.loyaltyPoints ?? 0}</p>
          <p className="mt-1 text-xs text-white/40">1 point pour chaque 1 000 FCFA dépensés</p>
        </div>
      </div>
    </div>
  );
}
