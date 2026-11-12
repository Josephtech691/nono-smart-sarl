import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, MessageCircle, ArrowLeft, Eye, EyeOff, Send, MailCheck } from 'lucide-react';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { WHATSAPP_NUMBER } from '../../config';
import usePageMeta from '../../utils/usePageMeta';

const RESEND_SECONDS = 60;

export default function ForgotPassword() {
  usePageMeta('Mot de passe oublié');
  const navigate = useNavigate();
  const resetPassword = useAuthStore((s) => s.resetPassword);

  const [step, setStep] = useState('request'); // 'request' -> 'reset'
  const [identifier, setIdentifier] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [smsAvailable, setSmsAvailable] = useState(true);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Bonjour Fresh Fish, j'ai oublié le mot de passe de mon compte${identifier.trim() ? ` (${identifier.trim()})` : ''}. Pouvez-vous m'aider ?`
  )}`;

  const requestCode = async (e) => {
    e?.preventDefault();
    setError('');
    if (identifier.trim().length < 3) {
      setError('Saisissez votre numéro de téléphone ou votre email.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(identifier.trim());
      setResetToken(res.resetToken);
      setSmsAvailable(res.smsAvailable !== false);
      setCode('');
      setStep('reset');
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err.message || "Impossible d'envoyer le code");
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code)) return setError('Le code contient 6 chiffres.');
    if (password.length < 6) return setError('Le mot de passe doit contenir au moins 6 caractères.');
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.');
    setLoading(true);
    try {
      await resetPassword({ resetToken, code, newPassword: password });
      toast.success('Mot de passe mis à jour. Vous êtes connecté.');
      navigate('/compte');
    } catch (err) {
      setError(err.message || 'Réinitialisation impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/10 text-brand-700">
        <KeyRound size={26} />
      </span>
      <h1 className="mt-4 text-center text-2xl font-bold">Mot de passe oublié</h1>
      <p className="mt-1 text-center text-ink/60">
        {step === 'request'
          ? 'Indiquez votre téléphone ou votre email : nous vous envoyons un code de vérification.'
          : 'Saisissez le code reçu par SMS et choisissez un nouveau mot de passe.'}
      </p>

      <div className="card mt-6 p-6">
        {step === 'request' ? (
          <form onSubmit={requestCode} className="space-y-4" noValidate>
            <div>
              <label className="label" htmlFor="identifier">Téléphone ou email</label>
              <input
                id="identifier"
                className="input"
                autoComplete="username"
                inputMode="text"
                placeholder="6XXXXXXXX ou vous@exemple.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoFocus
              />
            </div>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              {loading ? 'Envoi...' : 'Recevoir le code'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitReset} className="space-y-4" noValidate>
            <p className="flex items-start gap-2 rounded-lg bg-mist px-3 py-2.5 text-sm text-ink/70">
              <MailCheck size={17} className="mt-0.5 shrink-0 text-brand-700" />
              <span>
                Si un compte correspond à <strong className="text-ink">{identifier.trim()}</strong>, un code à 6 chiffres vient d'être envoyé par SMS
                (valable 15 minutes).
              </span>
            </p>

            {!smsAvailable && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="status">
                <p className="font-medium">L'envoi de SMS n'est pas encore activé sur ce site.</p>
                <p className="mt-0.5">Le code ne vous parviendra pas : écrivez-nous sur WhatsApp, nous réinitialiserons votre mot de passe avec vous.</p>
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="btn-primary mt-3 !py-2 text-sm">
                  <MessageCircle size={16} /> Écrire sur WhatsApp
                </a>
              </div>
            )}

            <div>
              <label className="label" htmlFor="code">Code de vérification</label>
              <input
                id="code"
                className="input text-center font-display text-2xl tracking-[0.5em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
              />
            </div>

            <div>
              <label className="label" htmlFor="newPassword">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="input pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <div>
              <label className="label" htmlFor="confirmPassword">Confirmer le mot de passe</label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}
              {loading ? 'Validation...' : 'Changer mon mot de passe'}
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <button type="button" onClick={requestCode} disabled={cooldown > 0 || loading} className="font-medium text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-ink/40 disabled:no-underline">
                Renvoyer le code{cooldown > 0 ? ` (${cooldown} s)` : ''}
              </button>
              <button type="button" onClick={() => { setStep('request'); setError(''); }} className="text-ink/60 hover:text-ink">
                Changer d'identifiant
              </button>
            </div>

            {smsAvailable && (
              <p className="border-t border-line pt-3 text-center text-xs text-ink/50">
                Pas de SMS au bout de quelques minutes ?{' '}
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">Contactez-nous sur WhatsApp</a>
              </p>
            )}
          </form>
        )}
      </div>

      <p className="mt-5 text-center text-sm text-ink/60">
        <Link to="/connexion" className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline">
          <ArrowLeft size={15} /> Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
