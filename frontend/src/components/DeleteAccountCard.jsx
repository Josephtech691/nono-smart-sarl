import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';

/**
 * Suppression du compte par le client (obligatoire pour la publication sur Google Play).
 * Ses données personnelles sont effacées ; ses commandes passées sont conservées sans lien avec lui.
 */
export default function DeleteAccountCard() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Compte avec mot de passe : on le demande. Compte Google (sans mot de passe) : on demande de taper SUPPRIMER.
  const withPassword = user?.hasPassword !== false;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await authApi.deleteAccount(withPassword ? { password: value } : { confirm: value });
      logout();
      toast.success('Votre compte a été supprimé.');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Suppression impossible, réessayez.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card border-red-200 p-6">
      <h2 className="font-display text-lg font-semibold text-red-700">Supprimer mon compte</h2>
      <p className="mt-1 text-sm text-ink/60">
        Vos informations personnelles (nom, téléphone, e-mail, adresses, favoris, points) sont effacées définitivement. Vos commandes passées sont conservées de façon anonyme pour la comptabilité.
      </p>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary mt-4 !border-red-300 !text-red-700 hover:!bg-red-50">
          <Trash2 size={16} /> Supprimer mon compte
        </button>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Cette action est définitive : vous ne pourrez plus vous connecter avec ce compte.</span>
          </p>
          <div>
            <label htmlFor="delete-confirm" className="label">{withPassword ? 'Entrez votre mot de passe pour confirmer' : 'Tapez SUPPRIMER pour confirmer'}</label>
            <input
              id="delete-confirm"
              className="input"
              type={withPassword ? 'password' : 'text'}
              autoComplete={withPassword ? 'current-password' : 'off'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => { setOpen(false); setValue(''); setError(''); }} disabled={busy} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={busy || !value} className="btn-primary !bg-red-600 hover:!bg-red-700">{busy ? 'Suppression…' : 'Supprimer définitivement'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
