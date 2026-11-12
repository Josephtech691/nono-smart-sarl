import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, Gift } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import usePageMeta from '../../utils/usePageMeta';

function FieldError({ error }) {
  if (!error) return null;
  return (
    <p className="mt-1 text-xs text-red-600" role="alert">
      {error.message || 'Champ requis'}
    </p>
  );
}

export default function Register() {
  usePageMeta('Créer un compte');
  const { register, handleSubmit, getValues, formState: { errors } } = useForm({
    // Un lien de parrainage /inscription?ref=CODE pre-remplit le champ.
    defaultValues: { referralCode: new URLSearchParams(window.location.search).get('ref') || '' },
  });
  const registerUser = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (data) => {
    setError('');
    setLoading(true);
    try {
      // La confirmation du mot de passe et l'acceptation des conditions ne sont pas envoyees au serveur.
      const { confirmPassword, acceptTerms, ...payload } = data;
      await registerUser({ ...payload, phone: payload.phone.trim(), email: payload.email?.trim() || '' });
      toast.success('Bienvenue chez Fresh Fish !');
      navigate('/compte');
    } catch (err) {
      setError(err.message || 'Inscription impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <img src="/brand/logo-full.png" alt="Fresh Fish" className="mx-auto h-36 w-auto" />
      <h1 className="text-center text-2xl font-bold">Créer un compte</h1>
      <p className="mt-1 text-center text-ink/60">Suivez vos commandes et gagnez des points de fidélité.</p>

      <div className="card mt-6 space-y-5 p-6">
        <GoogleSignInButton />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="firstName">Prénom</label>
              <input
                id="firstName"
                className="input"
                autoComplete="given-name"
                aria-invalid={!!errors.firstName}
                {...register('firstName', { required: 'Prénom requis', minLength: { value: 2, message: 'Prénom trop court' } })}
              />
              <FieldError error={errors.firstName} />
            </div>
            <div>
              <label className="label" htmlFor="lastName">Nom</label>
              <input
                id="lastName"
                className="input"
                autoComplete="family-name"
                aria-invalid={!!errors.lastName}
                {...register('lastName', { required: 'Nom requis', minLength: { value: 2, message: 'Nom trop court' } })}
              />
              <FieldError error={errors.lastName} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="phone">Téléphone</label>
            <input
              id="phone"
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="6XXXXXXXX"
              aria-invalid={!!errors.phone}
              {...register('phone', {
                required: 'Téléphone requis',
                validate: (v) => String(v).replace(/\D/g, '').length >= 8 || 'Numéro de téléphone invalide',
              })}
            />
            <FieldError error={errors.phone} />
          </div>
          <div>
            <label className="label" htmlFor="email">Email (facultatif)</label>
            <input id="email" type="email" className="input" autoComplete="email" {...register('email')} />
          </div>
          <div>
            <label className="label" htmlFor="password">Mot de passe</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="input pr-11"
                aria-invalid={!!errors.password}
                {...register('password', { required: 'Mot de passe requis', minLength: { value: 6, message: '6 caractères minimum' } })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/45 hover:text-ink"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <FieldError error={errors.password} />
          </div>
          <div>
            <label className="label" htmlFor="confirmPassword">Confirmer le mot de passe</label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="input"
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword', {
                required: 'Confirmez votre mot de passe',
                validate: (v) => v === getValues('password') || 'Les deux mots de passe ne correspondent pas',
              })}
            />
            <FieldError error={errors.confirmPassword} />
          </div>
          <div>
            <label className="label flex items-center gap-1.5" htmlFor="referralCode"><Gift size={14} className="text-brand-600" /> Code de parrainage (facultatif)</label>
            <input id="referralCode" className="input uppercase" placeholder="Ex : AMI1234" {...register('referralCode')} />
          </div>

          <div>
            <label className="flex items-start gap-2 text-sm text-ink/70">
              <input
                type="checkbox"
                className="mt-1"
                aria-invalid={!!errors.acceptTerms}
                {...register('acceptTerms', { required: 'Vous devez accepter les conditions pour créer un compte' })}
              />
              <span>
                J'accepte les{' '}
                <Link to="/conditions-generales" target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">conditions d'utilisation</Link>{' '}
                et la{' '}
                <Link to="/confidentialite" target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">politique de confidentialité</Link>.
              </span>
            </label>
            <FieldError error={errors.acceptTerms} />
          </div>

          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            <UserPlus size={17} /> {loading ? 'Création...' : "S'inscrire"}
          </button>
        </form>
      </div>

      <p className="mt-5 text-center text-sm text-ink/60">
        Déjà un compte ? <Link to="/connexion" className="font-semibold text-brand-700 hover:underline">Se connecter</Link>
      </p>
    </div>
  );
}
