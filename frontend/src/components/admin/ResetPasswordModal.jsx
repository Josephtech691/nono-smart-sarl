import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, MessageCircle } from 'lucide-react';
import Modal from './Modal';
import { toast } from '../../store/toastStore';
import { whatsappUrl } from '../../utils/format';
import { CLIENT_APP_URL, DRIVER_APP_URL } from '../../config';

/**
 * Réinitialisation du mot de passe d'un livreur ou d'un client par l'administrateur (aucun SMS n'est encore
 * branché) : confirmation, puis le mot de passe provisoire s'affiche UNE seule fois, avec un bouton pour
 * l'envoyer par WhatsApp. La personne le change ensuite depuis son profil.
 *  - target          : { id, name, phone } ou null (fenêtre fermée)
 *  - kind            : 'driver' | 'customer' (adresse de connexion donnée dans le message)
 *  - reset           : (id) => Promise<{ temporaryPassword }>
 *  - initialPassword : mot de passe déjà connu (compte tout juste créé) : on saute la confirmation et on
 *                      affiche directement « Compte créé » avec le moyen de transmettre les identifiants.
 */
export default function ResetPasswordModal({ target, kind, reset, onClose, initialPassword = '' }) {
  const [generated, setGenerated] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const created = Boolean(initialPassword);
  // Compte tout juste créé : le mot de passe est déjà connu et s'affiche dès l'ouverture (sans passer par la confirmation).
  const password = initialPassword || generated;

  // À chaque ouverture on repart de zéro : l'ancien mot de passe ne reste jamais en mémoire.
  useEffect(() => {
    setGenerated('');
    setError('');
    setCopied(false);
    setBusy(false);
  }, [target, initialPassword]);

  if (!target) return null;

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await reset(target.id);
      setGenerated(result.temporaryPassword);
    } catch (err) {
      setError(err.message || 'Réinitialisation impossible, réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copie impossible : sélectionnez le mot de passe et copiez-le à la main.');
    }
  };

  const firstName = String(target.name || '').split(' ')[0] || 'Bonjour';
  const loginUrl =
    kind === 'driver'
      ? `${DRIVER_APP_URL || window.location.origin}/livreur/connexion`
      : `${CLIENT_APP_URL || window.location.origin}/connexion`;
  const message = created
    ? `Bonjour ${firstName}, votre compte Fresh Fish est prêt.\nIdentifiant (téléphone) : ${target.phone}\nMot de passe : ${password}\nConnectez-vous sur ${loginUrl} puis changez le mot de passe dans votre profil.`
    : `Bonjour ${firstName}, voici votre mot de passe provisoire Fresh Fish : ${password}\nConnectez-vous sur ${loginUrl} puis changez-le dans votre profil.`;
  const whatsapp = password ? whatsappUrl(target.phone, message) : null;

  if (!password) {
    return (
      <Modal
        key="confirm"
        open
        onClose={onClose}
        busy={busy}
        icon={KeyRound}
        title="Réinitialiser le mot de passe"
        description={`${target.name} ne pourra plus se connecter avec son mot de passe actuel. Un mot de passe provisoire sera créé : vous le lui transmettez, il le changera depuis son profil.`}
      >
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary !py-3" data-autofocus>
            Annuler
          </button>
          <button type="button" onClick={run} disabled={busy} className="btn-primary !py-3">
            {busy ? 'Création…' : 'Réinitialiser'}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      key="result"
      open
      onClose={onClose}
      icon={KeyRound}
      title={created ? 'Compte créé' : 'Mot de passe provisoire'}
      description={
        created
          ? `Transmettez ses identifiants à ${target.name} : son téléphone sert d'identifiant. Le mot de passe ne sera plus affiché une fois cette fenêtre fermée.`
          : `Transmettez-le à ${target.name}. Il ne sera plus affiché une fois cette fenêtre fermée.`
      }
    >
      <div className="mt-4 rounded-xl2 border-2 border-dashed border-brand-600/40 bg-brand-500/5 px-4 py-4 text-center">
        <p data-testid="temp-password" className="select-all break-all font-mono text-2xl font-bold tracking-widest text-ink">
          {password}
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={copy} className="btn-secondary flex-1 !py-2.5">
          {copied ? <Check size={17} /> : <Copy size={17} />} {copied ? 'Copié' : 'Copier'}
        </button>
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1 !py-2.5">
            <MessageCircle size={17} /> Envoyer par WhatsApp
          </a>
        )}
      </div>
      <button type="button" onClick={onClose} className="btn-primary mt-3 w-full !py-3" data-autofocus>
        J'ai noté le mot de passe
      </button>
    </Modal>
  );
}
