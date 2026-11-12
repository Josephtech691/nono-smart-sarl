import { useEffect, useState } from 'react';
import { BadgeCheck, Undo2 } from 'lucide-react';
import Modal from './Modal';
import { paymentsApi } from '../../api/orders';
import { toast } from '../../store/toastStore';
import { PAYMENT_METHOD_SHORT_LABELS, formatFCFA } from '../../utils/format';

/**
 * Enregistrement manuel d'un paiement : « Marquer comme payé » (argent bien reçu) ou « Marquer comme remboursé »
 * (client remboursé hors du site, sur une commande annulée déjà payée). Tant que MTN / Orange ne confirment pas
 * seuls, c'est l'administration qui constate les paiements.
 *  - mode   : 'paid' | 'refund'
 *  - target : { orderId, orderNumber, amount, method, orderStatus } ou null (fenêtre fermée)
 *  - onDone : reçoit la ligne de paiement mise à jour
 */
export default function PaymentActionModal({ mode, target, onClose, onDone }) {
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Repart de zéro à chaque ouverture. On suit la commande visée (pas l'objet `target`, recréé à chaque rendu
  // du parent) : un rechargement en arrière-plan n'efface pas ce que l'on est en train de saisir.
  const targetKey = target ? target.orderId : null;
  useEffect(() => {
    setReference('');
    setNote('');
    setError('');
  }, [targetKey, mode]);

  if (!target) return null;
  const refund = mode === 'refund';
  const method = PAYMENT_METHOD_SHORT_LABELS[target.method] || 'paiement';
  const cash = target.method === 'CASH';

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const body = { reference: reference.trim() || undefined, note: note.trim() || undefined };
      const updated = refund ? await paymentsApi.markRefunded(target.orderId, body) : await paymentsApi.markPaid(target.orderId, body);
      toast.success(refund ? 'Remboursement enregistré' : 'Paiement enregistré');
      onDone(updated);
    } catch (err) {
      setError(err.message || "Enregistrement impossible, réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      icon={refund ? Undo2 : BadgeCheck}
      title={refund ? 'Marquer comme remboursé' : cash ? 'Espèces encaissées' : 'Marquer comme payé'}
      description={
        refund
          ? `La commande ${target.orderNumber} est annulée et ${formatFCFA(target.amount)} avaient été encaissés. Le site ne rembourse pas lui-même : faites le remboursement (Mobile Money ou espèces), puis enregistrez-le ici pour en garder la trace.`
          : `Commande ${target.orderNumber} : ${formatFCFA(target.amount)} par ${method}. À utiliser quand l'argent est bien reçu${
              cash ? ' (client qui a réglé à l\'avance : le livreur n\'aura rien à encaisser)' : ' (message de confirmation MTN / Orange reçu)'
            }.`
      }
    >
      <form onSubmit={submit} className="mt-4 space-y-4">
        {!refund && !cash && target.orderStatus === 'PENDING' && (
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">La commande sera aussi passée à « Confirmée » et le client prévenu.</p>
        )}
        <div>
          <label htmlFor="pay-reference" className="label">
            {refund ? 'Référence du remboursement (facultatif)' : 'Référence de la transaction (facultatif)'}
          </label>
          <input
            id="pay-reference"
            className="input"
            value={reference}
            maxLength={80}
            onChange={(e) => setReference(e.target.value)}
            placeholder={refund ? 'Ex : numéro de la transaction envoyée' : 'Ex : identifiant du message MTN / Orange'}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="pay-note" className="label">Note interne (facultatif)</label>
          <textarea id="pay-note" rows={2} className="input resize-none" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary !py-3">
            Annuler
          </button>
          <button type="submit" disabled={busy} className="btn-primary !py-3">
            {busy ? 'Enregistrement…' : refund ? 'Enregistrer' : 'Confirmer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
