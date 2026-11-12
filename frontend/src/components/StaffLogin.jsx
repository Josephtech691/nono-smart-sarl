import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import usePageMeta from '../utils/usePageMeta';
import { isStandaloneApp } from '../appTarget';

/**
 * Connexion de l'espace livreur et de l'administration (même écran, textes différents).
 * Un compte d'un autre rôle est refusé ET déconnecté : sans cela, un client qui se trompe
 * d'adresse resterait connecté en arrière-plan alors que l'écran affiche une erreur.
 */
export default function StaffLogin({ role, home, pageTitle, title, identifierLabel, identifierMode = 'text', wrongRoleMessage }) {
  usePageMeta(pageTitle);
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Retour à la page demandée avant la connexion (ex. une livraison ouverte depuis une notification).
  const requested = location.state?.from?.pathname;
  const destination = requested && requested.startsWith(home) ? requested : home;

  if (status === 'ready' && user?.role === role) return <Navigate to={destination} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!identifier.trim() || !password) return setError('Saisissez votre identifiant et votre mot de passe');
    setError('');
    setLoading(true);
    try {
      const account = await login({ phone: identifier.trim(), password });
      if (account.role !== role) {
        logout();
        setError(wrongRoleMessage);
        return;
      }
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-pine-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-white">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white p-2">
            <img src="/brand/logo-icon-raw.png" alt="" className="h-full w-full object-contain" />
          </span>
          <h1 className="mt-3 font-display text-xl font-bold">{title}</h1>
          <p className="text-sm text-white/40">Fresh Fish</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-xl2 bg-white p-6" noValidate>
          <div>
            <label htmlFor="staff-identifier" className="label">{identifierLabel}</label>
            <input
              id="staff-identifier"
              type="text"
              inputMode={identifierMode}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="input"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setError('');
              }}
            />
          </div>
          <div>
            <label htmlFor="staff-password" className="label">Mot de passe</label>
            <div className="relative">
              <input
                id="staff-password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                className="input pr-12"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={show}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink/45 hover:text-ink"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 size={17} className="animate-spin" /> : <LogIn size={17} />} {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        {!isStandaloneApp() && (
          <Link to="/" className="mt-5 block text-center text-sm text-white/50 hover:text-white">
            ← Retour au site
          </Link>
        )}
      </div>
    </div>
  );
}
