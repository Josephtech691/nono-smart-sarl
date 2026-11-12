import { useEffect, useState } from 'react';
import { AlertTriangle, PhoneOff, MapPinOff, UserX, PackageX, X } from 'lucide-react';

// Les valeurs correspondent exactement a l'enum accepte par l'API
// (reportIssueSchema cote backend).
export const ISSUE_REASONS = [
  { value: 'CLIENT_INJOIGNABLE', label: 'Client injoignable', hint: "Il ne répond pas au téléphone", icon: PhoneOff },
  { value: 'ADRESSE_INTROUVABLE', label: 'Adresse introuvable', hint: "Je ne parviens pas à localiser l'adresse", icon: MapPinOff },
  { value: 'CLIENT_ABSENT', label: 'Client absent', hint: "Personne ne peut réceptionner la commande", icon: UserX },
  { value: 'COLIS_REFUSE', label: 'Colis refusé', hint: 'Le client refuse la livraison', icon: PackageX },
  { value: 'AUTRE', label: 'Autre problème', hint: 'Précisez dans la note', icon: AlertTriangle },
];

const NOTE_MAX = 500;

/**
 * Feuille modale "Problème avec la livraison" (espace livreur, mobile first).
 * `onSubmit({ reason, note })` doit renvoyer une promesse ; la modale reste
 * ouverte en cas d'echec pour que le livreur puisse reessayer.
 */
export default function ReportIssueModal({ open, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, busy, onClose]);

  useEffect(() => {
    if (open) {
      setReason('');
      setNote('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!reason) return setError('Choisissez un motif');
    setError('');
    setBusy(true);
    try {
      await onSubmit({ reason, note: note.trim() || undefined });
    } catch (err) {
      setError(err.message || "Impossible d'envoyer le signalement");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-pine-950/60 backdrop-blur-[2px]"
        onClick={() => !busy && onClose()}
      />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="issue-title"
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl animate-fade-up"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="issue-title" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
              <AlertTriangle size={20} className="text-amber-600" /> Problème avec la livraison
            </h2>
            <p className="mt-1 text-sm text-ink/55">
              L'administrateur est prévenu immédiatement et décidera de la suite (nouvelle tentative, autre livreur ou annulation).
            </p>
          </div>
          <button type="button" onClick={() => !busy && onClose()} aria-label="Fermer" className="rounded-full p-1.5 text-ink/50 hover:bg-mist hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">Motif du problème</legend>
          {ISSUE_REASONS.map(({ value, label, hint, icon: Icon }) => {
            const selected = reason === value;
            return (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3.5 py-3 transition ${
                  selected ? 'border-amber-500 bg-amber-50' : 'border-line hover:border-ink/25'
                }`}
              >
                <input type="radio" name="reason" value={value} checked={selected} onChange={() => setReason(value)} className="sr-only" />
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-amber-500 text-white' : 'bg-mist text-ink/60'}`}>
                  <Icon size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{label}</span>
                  <span className="block text-xs text-ink/50">{hint}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="mt-4">
          <label htmlFor="issue-note" className="label">Précisions (facultatif)</label>
          <textarea
            id="issue-note"
            rows={3}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex : j'ai appelé 3 fois sans réponse, je suis devant le portail bleu."
            className="input resize-none"
          />
          <p className="mt-1 text-right text-xs text-ink/40">{note.length}/{NOTE_MAX}</p>
        </div>

        {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary !py-3">Annuler</button>
          <button type="submit" disabled={busy || !reason} className="btn-primary !bg-amber-600 !py-3 hover:!bg-amber-700">
            {busy ? 'Envoi...' : 'Signaler'}
          </button>
        </div>
      </form>
    </div>
  );
}
