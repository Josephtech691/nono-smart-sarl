import { useEffect, useState } from 'react';
import { Repeat, Pause, Play, Trash2 } from 'lucide-react';
import { recurringOrdersApi } from '../../api/recurring';
import AccountBack from '../../components/AccountBack';
import EmptyState from '../../components/EmptyState';
import { RowSkeleton } from '../../components/Skeleton';
import { toast } from '../../store/toastStore';
import { formatFCFA, formatDate, FREQUENCY_LABELS, PAYMENT_METHOD_LABELS } from '../../utils/format';

export default function RecurringOrders() {
  const [recurring, setRecurring] = useState(null);

  const load = () => recurringOrdersApi.list().then(setRecurring).catch(() => setRecurring([]));

  useEffect(() => { load(); }, []);

  const toggleActive = async (r) => {
    await recurringOrdersApi.update(r.id, { isActive: !r.isActive });
    toast.success(r.isActive ? 'Commande récurrente mise en pause' : 'Commande récurrente réactivée');
    load();
  };

  const remove = async (r) => {
    if (!confirm('Supprimer cette commande récurrente ?')) return;
    await recurringOrdersApi.remove(r.id);
    toast.success('Commande récurrente supprimée');
    load();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Commandes récurrentes</h1>
      <AccountBack />

      <p className="mb-4 text-sm text-ink/60">
        Les commandes habituelles sont générées automatiquement à leur échéance et vous êtes prévenu par notification.
        Créez-en une depuis le récapitulatif au moment du paiement (« Faire de cette commande une commande habituelle »).
      </p>

      {recurring === null ? (
        <RowSkeleton />
      ) : recurring.length === 0 ? (
        <EmptyState icon={Repeat} title="Aucune commande récurrente" description="Activez cette option lors de votre prochain paiement pour ne plus avoir à repasser commande à chaque fois." />
      ) : (
        <div className="space-y-3">
          {recurring.map((r) => (
            <div key={r.id} className={`card p-4 ${!r.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display font-semibold text-ink">{r.label || 'Commande habituelle'}</p>
                  <p className="text-xs text-ink/50">{FREQUENCY_LABELS[r.frequency]} · {PAYMENT_METHOD_LABELS[r.paymentMethod]}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleActive(r)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink/50 hover:bg-mist" title={r.isActive ? 'Mettre en pause' : 'Réactiver'}>
                    {r.isActive ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <button onClick={() => remove(r)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink/50 hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-ink/50">
                Prochaine commande : {formatDate(r.nextRunAt)}
                {r.lastRunAt && ` · Dernière : ${formatDate(r.lastRunAt)}`}
              </p>
              {r.generatedOrders?.length > 0 && (
                <p className="mt-1 text-xs text-ink/40">{r.generatedOrders.length} commande(s) générée(s) récemment</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
