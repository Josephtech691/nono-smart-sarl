import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import usePageMeta from '../../utils/usePageMeta';

export default function Login() {
  usePageMeta('Connexion');
  // « Se souvenir de moi » est coche par defaut (comportement historique : session durable).
  const { register, handleSubmit } = useForm({ defaultValues: { remember: true } });
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (data) => {
    setError('');
    setLoading(true);
    try {
      const user = await login({ phone: data.phone.trim(), password: data.password, remember: !!data.remember });
      if (user.role === 'ADMIN') navigate('/admin');
      else if (user.role === 'DRIVER') navigate('/livreur');
      else navigate(location.state?.from?.pathname || '/compte');
    } catch (err) {
      setError(err.message || 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <img src="/brand/logo-full.png" alt="Fresh Fish" className="mx-auto h-40 w-auto" />
      <h1 className="text-center text-2xl font-bold">Connexion</h1>
      <p className="mt-1 text-center text-ink/60">Accédez à vos commandes et vos adresses.</p>

      <div className="card mt-6 space-y-5 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label" htmlFor="phone">Téléphone ou email</label>
            <input id="phone" className="input" autoComplete="username" {...register('phone', { required: true })} />
          </div>
          <div>
            <label className="label" htmlFor="password">Mot de passe</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="input pr-11"
                {...register('password', { required: true })}
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
          </div>

          <div className="flex items-center justify-between gap-3 text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-ink/70">
              <input type="checkbox" {...register('remember')} /> Se souvenir de moi
            </label>
            <Link to="/mot-de-passe-oublie" className="font-medium text-brand-700 hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>

          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            <LogIn size={17} /> {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <GoogleSignInButton />
      </div>

      <p className="mt-5 text-center text-sm text-ink/60">
        Pas encore de compte ? <Link to="/inscription" className="font-semibold text-brand-700 hover:underline">Créer un compte</Link>
      </p>
      <p className="mt-2 text-center text-sm text-ink/60">
        Ou <Link to="/checkout" className="font-semibold text-brand-700 hover:underline">commandez sans compte</Link>
      </p>
    </div>
  );
}
