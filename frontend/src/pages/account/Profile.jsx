import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Award, AlertTriangle, Save, KeyRound, LogOut, Gift, Star, Package } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth';
import { toast } from '../../store/toastStore';
import AccountBack from '../../components/AccountBack';

const PENDING_PREFIX = 'google-pending-';

export default function Profile() {
  const { user, updateProfile, logout } = useAuthStore();
  const needsPhone = user?.needsProfileCompletion || user?.phone?.startsWith(PENDING_PREFIX);
  const points = user?.customerProfile?.loyaltyPoints ?? 0;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: needsPhone ? '' : user?.phone || '',
      email: user?.email || '',
    },
  });

  const pwd = useForm();
  const [pwdBusy, setPwdBusy] = useState(false);

  const onSubmit = async (values) => {
    try {
      await updateProfile({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
      });
      toast.success('Profil mis à jour');
    } catch (err) {
      toast.error(err.message || 'Mise à jour impossible');
    }
  };

  const onChangePassword = async (values) => {
    setPwdBusy(true);
    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword || undefined,
        newPassword: values.newPassword,
      });
      toast.success('Mot de passe mis à jour');
      pwd.reset();
    } catch (err) {
      toast.error(err.message || 'Changement impossible');
    } finally {
      setPwdBusy(false);
    }
  };

  // Un compte cree via Google n'a pas encore de mot de passe : pas besoin de l'ancien.
  const hasPassword = user?.hasPassword !== false;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Mon profil</h1>
      <AccountBack />

      {needsPhone && (
        <div role="alert" className="mb-5 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <p>
            <strong>Une dernière étape :</strong> ajoutez votre numéro de téléphone. Il est indispensable pour que le
            livreur puisse vous joindre et pour confirmer vos livraisons.
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Informations personnelles</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Prénom</label>
                <input className="input" {...register('firstName', { required: true, minLength: 2 })} />
                {errors.firstName && <p className="mt-1 text-xs text-red-600">2 caractères minimum</p>}
              </div>
              <div>
                <label className="label">Nom</label>
                <input className="input" {...register('lastName', { required: true, minLength: 2 })} />
                {errors.lastName && <p className="mt-1 text-xs text-red-600">2 caractères minimum</p>}
              </div>
            </div>
            <div>
              <label className="label">Téléphone {needsPhone && <span className="text-amber-700">(à renseigner)</span>}</label>
              <input
                className={`input ${needsPhone ? 'border-amber-400' : ''}`}
                inputMode="tel"
                placeholder="6XXXXXXXX"
                {...register('phone', { required: true, minLength: 8 })}
              />
              {errors.phone && <p className="mt-1 text-xs text-red-600">Numéro invalide (8 chiffres minimum)</p>}
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" {...register('email')} />
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              <Save size={17} /> {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>

          <form onSubmit={pwd.handleSubmit(onChangePassword)} className="card space-y-4 p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <KeyRound size={18} className="text-brand-600" /> {hasPassword ? 'Changer le mot de passe' : 'Définir un mot de passe'}
            </h2>
            {user?.googleId && (
              <p className="text-sm text-ink/55">
                Vous vous connectez avec Google. Vous pouvez aussi définir un mot de passe pour vous connecter avec votre
                numéro de téléphone.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {hasPassword && (
                <div>
                  <label className="label">Mot de passe actuel</label>
                  <input type="password" autoComplete="current-password" className="input" {...pwd.register('currentPassword', { required: true })} />
                </div>
              )}
              <div>
                <label className="label">Nouveau mot de passe</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="input"
                  {...pwd.register('newPassword', { required: true, minLength: 6 })}
                />
                {pwd.formState.errors.newPassword && <p className="mt-1 text-xs text-red-600">6 caractères minimum</p>}
              </div>
            </div>
            <button type="submit" disabled={pwdBusy} className="btn-secondary">
              {pwdBusy ? 'Mise à jour...' : 'Mettre à jour'}
            </button>
          </form>
        </div>

        <aside className="space-y-5">
          <div className="card bg-pine-900 p-5 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              <Award size={18} className="text-brand-500" />
            </span>
            <p className="mt-3 text-sm text-white/60">Points de fidélité</p>
            <p className="font-display text-3xl font-bold">{points}</p>
            <p className="mt-1 text-xs text-white/45">1 point pour chaque 1 000 FCFA dépensés</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, (points % 100))}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-white/45">{100 - (points % 100)} points avant le prochain palier de 100</p>
          </div>

          <div className="card divide-y divide-line">
            <Link to="/compte/parrainage" className="flex items-center gap-3 p-4 text-sm font-medium transition hover:bg-mist">
              <Gift size={18} className="text-brand-600" /> Parrainer un ami
            </Link>
            <Link to="/compte/commandes" className="flex items-center gap-3 p-4 text-sm font-medium transition hover:bg-mist">
              <Package size={18} className="text-brand-600" /> Mes commandes
            </Link>
            <Link to="/compte/avis" className="flex items-center gap-3 p-4 text-sm font-medium transition hover:bg-mist">
              <Star size={18} className="text-brand-600" /> Mes avis
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-3 p-4 text-left text-sm font-medium text-red-700 transition hover:bg-red-50"
            >
              <LogOut size={18} /> Se déconnecter
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
