import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, ChevronDown, KeyRound, LifeBuoy, LogOut, Phone } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useDriverStore } from '../../store/driverStore';
import { authApi } from '../../api/auth';
import AvailabilityPicker from '../../components/driver/AvailabilityPicker';
import { toast } from '../../store/toastStore';
import usePageMeta from '../../utils/usePageMeta';
import { initialsOf } from '../../utils/delivery';
import { formatFCFA } from '../../utils/format';
import { WHATSAPP_NUMBER, WHATSAPP_NUMBER_DISPLAY } from '../../config';

const EMPTY_FORM = { currentPassword: '', newPassword: '', confirm: '' };

function ChangePassword() {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const hasPassword = user?.hasPassword !== false;

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (hasPassword && !form.currentPassword) return setError('Saisissez votre mot de passe actuel');
    if (form.newPassword.length < 6) return setError('Le nouveau mot de passe doit contenir au moins 6 caractères');
    if (form.newPassword !== form.confirm) return setError('Les deux nouveaux mots de passe ne correspondent pas');
    setBusy(true);
    try {
      await authApi.changePassword({ currentPassword: hasPassword ? form.currentPassword : undefined, newPassword: form.newPassword });
      toast.success('Mot de passe mis à jour');
      setForm(EMPTY_FORM);
      setOpen(false);
    } catch (err) {
      setError(err.message || 'Changement impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="password-form"
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
          <KeyRound size={17} className="text-brand-700" /> Changer mon mot de passe
        </span>
        <ChevronDown size={18} className={`text-ink/40 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <form id="password-form" onSubmit={submit} className="mt-4 space-y-3" noValidate>
          {hasPassword && (
            <div>
              <label htmlFor="pwd-current" className="label">Mot de passe actuel</label>
              <input id="pwd-current" type="password" autoComplete="current-password" className="input" value={form.currentPassword} onChange={set('currentPassword')} />
            </div>
          )}
          <div>
            <label htmlFor="pwd-new" className="label">Nouveau mot de passe</label>
            <input id="pwd-new" type="password" autoComplete="new-password" className="input" value={form.newPassword} onChange={set('newPassword')} />
            <p className="mt-1 text-xs text-ink/45">6 caractères minimum</p>
          </div>
          <div>
            <label htmlFor="pwd-confirm" className="label">Confirmer le nouveau mot de passe</label>
            <input id="pwd-confirm" type="password" autoComplete="new-password" className="input" value={form.confirm} onChange={set('confirm')} />
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      )}
    </section>
  );
}

export default function DriverProfile() {
  usePageMeta('Mon profil');
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const summary = useDriverStore((s) => s.summary);
  const refresh = useDriverStore((s) => s.refresh);
  const reset = useDriverStore((s) => s.reset);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  const vehicle = user?.driverProfile?.vehicle;
  const help = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Bonjour, je suis ${fullName || 'un livreur'} (livreur Fresh Fish) et j'ai besoin d'aide.`)}`;

  const handleLogout = () => {
    logout();
    reset();
    navigate('/livreur/connexion');
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink">Mon profil</h1>

      <section className="card p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-pine-900 font-display text-lg font-bold text-brand-500" aria-hidden="true">
            {initialsOf(fullName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold text-ink">{fullName || 'Livreur'}</p>
            {user?.phone && (
              <p className="flex items-center gap-1.5 text-sm text-ink/60">
                <Phone size={13} /> {user.phone}
              </p>
            )}
            {vehicle && (
              <p className="flex items-center gap-1.5 text-sm text-ink/60">
                <Bike size={14} /> {vehicle}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4">
          <AvailabilityPicker />
        </div>
      </section>

      {summary && (
        <section className="card p-4" aria-label="Mes chiffres">
          <h2 className="mb-3 font-display text-sm font-semibold text-ink">Mes chiffres</h2>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl2 bg-mist px-2 py-3">
              <dd className="font-display text-xl font-bold text-ink" data-testid="stat-delivered">{summary.delivered}</dd>
              <dt className="text-[11px] text-ink/55">Livrées</dt>
            </div>
            <div className="rounded-xl2 bg-mist px-2 py-3">
              <dd className="font-display text-xl font-bold text-ink" data-testid="stat-failed">{summary.failed}</dd>
              <dt className="text-[11px] text-ink/55">Sans suite</dt>
            </div>
            <div className="rounded-xl2 bg-mist px-2 py-3">
              <dd className="font-display text-sm font-bold leading-7 text-ink" data-testid="stat-cash">{formatFCFA(summary.total.cashCollected)}</dd>
              <dt className="text-[11px] text-ink/55">En espèces</dt>
            </div>
          </dl>
        </section>
      )}

      <ChangePassword />

      <a href={help} target="_blank" rel="noreferrer" className="card flex items-center gap-3 p-4 transition hover:border-brand-500/40">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-700">
          <LifeBuoy size={19} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">Besoin d'aide ?</span>
          <span className="block text-xs text-ink/55">Écrire à l'administration sur WhatsApp ({WHATSAPP_NUMBER_DISPLAY})</span>
        </span>
      </a>

      <button type="button" onClick={handleLogout} className="btn-secondary w-full !border-red-200 !text-red-700 hover:!bg-red-50">
        <LogOut size={17} /> Me déconnecter
      </button>
    </div>
  );
}
