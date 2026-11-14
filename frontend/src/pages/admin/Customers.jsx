import { useEffect, useState } from 'react';
import { BadgeCheck, BadgeDollarSign, Building2, KeyRound, Power, Users } from 'lucide-react';
import { customersApi } from '../../api/customers';
import EmptyState from '../../components/EmptyState';
import { RowSkeleton } from '../../components/Skeleton';
import Modal from '../../components/admin/Modal';
import Pagination from '../../components/admin/Pagination';
import CustomerPricesModal from '../../components/admin/CustomerPricesModal';
import ResetPasswordModal from '../../components/admin/ResetPasswordModal';
import SearchBox from '../../components/admin/SearchBox';
import TabBar from '../../components/admin/TabBar';
import useAdminList from '../../hooks/useAdminList';
import useUrlFilters from '../../hooks/useUrlFilters';
import { toast } from '../../store/toastStore';
import { formatDay, formatPhone, isPendingPhone, PROFESSIONAL_STATUS_LABELS } from '../../utils/format';
import usePageMeta from '../../utils/usePageMeta';

const PAGE_SIZE = 20;
const REFRESH_MS = 60000;
const DEFAULTS = { statut: '', q: '', page: '1' };
const DEFAULT_DISCOUNT = '5';

const STATUS_STYLES = {
  NONE: 'bg-mist text-ink/50',
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-brand-500/15 text-brand-700',
  REJECTED: 'bg-red-100 text-red-700',
};

const TABS = [
  { value: '', label: 'Tous' },
  { value: 'PENDING', label: 'Demandes pro', alert: true },
  { value: 'APPROVED', label: 'Professionnels' },
  { value: 'REJECTED', label: 'Refusées' },
];

const knownTab = (value) => (TABS.some((t) => t.value === value) ? value : '');
const customerName = (customer) => `${customer.user.firstName} ${customer.user.lastName}`.trim();
// Compte créé avec Google, sans téléphone ni email saisis : rien pour se connecter avec un mot de passe.
const googleOnly = (customer) => isPendingPhone(customer.user.phone) && !customer.user.email;

function PhoneCell({ customer }) {
  const phone = customer.user.phone;
  if (!phone || isPendingPhone(phone)) return <span className="text-ink/40">Non renseigné</span>;
  return (
    <a href={`tel:${phone}`} className="text-ink/80 hover:text-brand-700 hover:underline">
      {formatPhone(phone)}
    </a>
  );
}

function StatusCell({ customer }) {
  const status = customer.professionalStatus || 'NONE';
  return (
    <div>
      <span className={`badge ${STATUS_STYLES[status] || STATUS_STYLES.NONE}`}>{PROFESSIONAL_STATUS_LABELS[status] || status}</span>
      {status === 'APPROVED' && customer.wholesaleDiscountPercent > 0 && <p className="mt-1 text-xs text-ink/50">Remise {customer.wholesaleDiscountPercent} %</p>}
    </div>
  );
}

const isDeleted = (customer) => String(customer.user?.phone || '').startsWith('deleted-');

function Identity({ customer }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold text-ink">{customerName(customer)}</p>
      {customer.businessName && <p className="text-xs text-ink/55">{customer.businessName}</p>}
      {customer.user.email && <p className="truncate text-xs text-ink/45">{customer.user.email}</p>}
      {googleOnly(customer) && <span className="badge mt-1 bg-mist text-ink/60">Connecté avec Google</span>}
      {isDeleted(customer) ? (
        <span className="badge ml-1 mt-1 bg-ink/10 text-ink/70">Compte supprimé</span>
      ) : (
        !customer.user.isActive && <span className="badge ml-1 mt-1 bg-red-100 text-red-700">Compte désactivé</span>
      )}
    </div>
  );
}

function Actions({ customer, onReview, onReset, onPrices, onToggle }) {
  const name = customerName(customer);
  if (isDeleted(customer)) return <p className="text-xs text-ink/45">Supprimé par le client</p>;
  return (
    <div className="flex flex-wrap items-center gap-2 md:justify-end">
      {customer.professionalStatus === 'PENDING' && (
        <button type="button" data-action="review" onClick={() => onReview(customer)} aria-label={`Examiner la demande de ${name}`} className="btn-primary !px-3 !py-1.5 text-xs">
          <Building2 size={14} aria-hidden="true" /> Examiner
        </button>
      )}
      <button type="button" data-action="prices" onClick={() => onPrices(customer)} aria-label={`Prix négociés de ${name}`} className="btn-secondary !px-3 !py-1.5 text-xs">
        <BadgeDollarSign size={14} aria-hidden="true" /> Prix
      </button>
      <button
        type="button"
        data-action="toggle-active"
        onClick={() => onToggle(customer)}
        aria-label={`${customer.user.isActive ? 'Désactiver' : 'Activer'} le compte de ${name}`}
        className={`btn-secondary !px-3 !py-1.5 text-xs ${customer.user.isActive ? '!border-red-300 !text-red-700 hover:!bg-red-50' : '!border-brand-600 !text-brand-700'}`}
      >
        <Power size={14} aria-hidden="true" /> {customer.user.isActive ? 'Désactiver' : 'Activer'}
      </button>
      {!googleOnly(customer) && (
        <button type="button" data-action="reset" onClick={() => onReset(customer)} aria-label={`Réinitialiser le mot de passe de ${name}`} className="btn-secondary !px-3 !py-1.5 text-xs">
          <KeyRound size={14} aria-hidden="true" /> Mot de passe
        </button>
      )}
    </div>
  );
}

export default function AdminCustomers() {
  usePageMeta('Clients');
  const [filters, setFilters] = useUrlFilters(DEFAULTS);
  const tab = knownTab(filters.statut);
  const page = Math.max(1, parseInt(filters.page, 10) || 1);

  const params = { page, limit: PAGE_SIZE };
  if (filters.q) params.search = filters.q;
  if (tab) params.professionalStatus = tab;

  const list = useAdminList((p) => customersApi.list(p), params, { refreshMs: REFRESH_MS });
  // Nombre de demandes de compte professionnel à traiter : pastille rouge sur l'onglet « Demandes pro ».
  const pending = useAdminList((p) => customersApi.list(p), { professionalStatus: 'PENDING', limit: 1 }, { refreshMs: REFRESH_MS });
  const { data, loading, error, reload } = list;

  const [reviewing, setReviewing] = useState(null);
  const [discount, setDiscount] = useState(DEFAULT_DISCOUNT);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [resetTarget, setResetTarget] = useState(null);
  const [pricesTarget, setPricesTarget] = useState(null);

  // Active / désactive le compte d'un client (un compte désactivé ne peut plus se connecter).
  const toggleActive = async (customer) => {
    const next = !customer.user.isActive;
    const name = customerName(customer);
    const ok = window.confirm(next ? `Réactiver le compte de ${name} ?` : `Désactiver le compte de ${name} ? Il ne pourra plus se connecter ni recevoir de notifications.`);
    if (!ok) return;
    try {
      await customersApi.setActive(customer.id, next);
      toast.success(next ? 'Compte activé' : 'Compte désactivé');
      reload();
    } catch (err) {
      toast.error(err.message || 'Action impossible');
    }
  };

  const items = data?.items || [];
  const total = data?.total || 0;
  const hasSearch = Boolean(filters.q);

  const tabs = TABS.map((t) => ({ ...t, count: t.value === 'PENDING' ? pending.data?.total : undefined }));
  const change = (patch) => setFilters({ ...patch, page: 1 });

  // Une page qui n'existe plus (lien ancien, liste devenue plus courte) ramène à la dernière page.
  useEffect(() => {
    if (data && total > 0 && items.length === 0 && page > 1) setFilters({ page: Math.ceil(total / PAGE_SIZE) });
  }, [data, total, items.length, page, setFilters]);

  const openReview = (customer) => {
    setReviewing(customer);
    setDiscount(DEFAULT_DISCOUNT);
    setReviewError('');
  };

  const closeReview = () => {
    if (!reviewBusy) setReviewing(null);
  };

  const decide = async (status) => {
    let percent = 0;
    if (status === 'APPROVED') {
      percent = Number(discount);
      if (discount.trim() === '' || !Number.isInteger(percent) || percent < 0 || percent > 50) {
        setReviewError('La remise doit être un nombre entier compris entre 0 et 50 %.');
        return;
      }
    }
    setReviewBusy(true);
    setReviewError('');
    try {
      await customersApi.updateProfessionalStatus(reviewing.id, { status, wholesaleDiscountPercent: percent });
      toast.success(status === 'APPROVED' ? 'Compte professionnel approuvé' : 'Demande refusée');
      setReviewing(null);
      await Promise.all([reload({ silent: true }), pending.reload({ silent: true })]);
    } catch (err) {
      setReviewError(err.message || 'Enregistrement impossible, réessayez.');
    } finally {
      setReviewBusy(false);
    }
  };

  const openReset = (customer) =>
    setResetTarget({ id: customer.id, name: customerName(customer), phone: isPendingPhone(customer.user.phone) ? '' : customer.user.phone });

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-ink">Clients</h1>
        <p className="text-sm text-ink/55">Vos clients, leurs demandes de compte professionnel et l’accès à leur compte.</p>
      </div>

      <div className="mt-5">
        <TabBar tabs={tabs} value={tab} onChange={(value) => change({ statut: value })} label="Clients par type de compte" />
      </div>
      <div className="mt-4 max-w-md">
        <SearchBox value={filters.q} onSearch={(q) => change({ q })} placeholder="Rechercher : nom, téléphone, email…" label="Rechercher un client" />
      </div>

      <div className={`mt-5 transition-opacity ${loading && data ? 'opacity-60' : ''}`} aria-busy={loading}>
        {error && !data ? (
          <EmptyState
            icon={Users}
            title="Chargement impossible"
            description={error}
            action={
              <button type="button" onClick={() => reload()} className="btn-primary mt-2">
                Réessayer
              </button>
            }
          />
        ) : !data ? (
          <RowSkeleton count={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={hasSearch || tab ? 'Aucun client trouvé' : 'Aucun client pour le moment'}
            description={hasSearch ? 'Aucun client ne correspond à cette recherche.' : tab ? 'Aucun client dans cet onglet.' : 'Les clients apparaissent ici dès qu’ils créent un compte.'}
            action={
              hasSearch || tab ? (
                <button type="button" onClick={() => change({ q: '', statut: '' })} className="btn-secondary mt-2 !px-4 !py-2 text-sm">
                  Effacer les filtres
                </button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="card hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm" data-testid="customers-table">
                <thead className="border-b border-line bg-mist/60 text-xs uppercase tracking-wide text-ink/50">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Client</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Téléphone</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Commandes</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Compte</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Inscrit le</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((c) => (
                    <tr key={c.id} className="transition hover:bg-mist/40" data-customer={customerName(c)}>
                      <td className="px-4 py-3">
                        <Identity customer={c} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <PhoneCell customer={c} />
                      </td>
                      <td className="px-4 py-3 text-ink/70">{c._count?.orders ?? 0}</td>
                      <td className="px-4 py-3">
                        <StatusCell customer={c} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink/55">{formatDay(c.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Actions customer={c} onReview={openReview} onReset={openReset} onPrices={setPricesTarget} onToggle={toggleActive} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 md:hidden" data-testid="customers-cards">
              {items.map((c) => (
                <li key={c.id} className="card p-4" data-customer={customerName(c)}>
                  <div className="flex items-start justify-between gap-3">
                    <Identity customer={c} />
                    <StatusCell customer={c} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3 text-sm">
                    <div className="col-span-2">
                      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink/40">Téléphone</p>
                      <PhoneCell customer={c} />
                    </div>
                    <div className="text-right">
                      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink/40">Commandes</p>
                      <p className="font-semibold text-ink">{c._count?.orders ?? 0}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-ink/45">Inscrit le {formatDay(c.createdAt)}</p>
                  <div className="mt-3 border-t border-line pt-3">
                    <Actions customer={c} onReview={openReview} onReset={openReset} onPrices={setPricesTarget} onToggle={toggleActive} />
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5">
              <Pagination
                page={page}
                limit={PAGE_SIZE}
                total={total}
                onChange={(p) => {
                  setFilters({ page: p });
                  window.scrollTo({ top: 0 });
                }}
              />
            </div>
          </>
        )}
      </div>

      <Modal
        open={Boolean(reviewing)}
        onClose={closeReview}
        busy={reviewBusy}
        size="sm"
        icon={Building2}
        title="Demande de compte professionnel"
        description={reviewing ? [reviewing.businessName || customerName(reviewing), isPendingPhone(reviewing.user.phone) ? null : formatPhone(reviewing.user.phone), reviewing.taxId].filter(Boolean).join(' · ') : ''}
      >
        <div className="mt-4">
          <label htmlFor="wholesale-discount" className="label">
            Remise grossiste à appliquer (%)
          </label>
          <input
            id="wholesale-discount"
            type="number"
            inputMode="numeric"
            min="0"
            max="50"
            step="1"
            className="input"
            value={discount}
            onChange={(e) => {
              setDiscount(e.target.value);
              setReviewError('');
            }}
            data-autofocus
          />
          <p className="mt-1 text-xs text-ink/50">Appliquée sur ses commandes s’il est approuvé (0 à 50 %).</p>
        </div>
        {reviewError && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {reviewError}
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => decide('REJECTED')} disabled={reviewBusy} className="btn-secondary !border-red-300 !py-3 !text-red-600 hover:!bg-red-50" data-testid="reject-pro">
            Refuser
          </button>
          <button type="button" onClick={() => decide('APPROVED')} disabled={reviewBusy} className="btn-primary !py-3" data-testid="approve-pro">
            <BadgeCheck size={16} aria-hidden="true" /> {reviewBusy ? 'Envoi…' : 'Approuver'}
          </button>
        </div>
        <button type="button" onClick={closeReview} disabled={reviewBusy} className="mt-3 w-full text-center text-xs text-ink/50 hover:underline">
          Annuler
        </button>
      </Modal>

      <CustomerPricesModal customer={pricesTarget} name={pricesTarget ? customerName(pricesTarget) : ''} onClose={() => setPricesTarget(null)} />
      <ResetPasswordModal target={resetTarget} kind="customer" reset={customersApi.resetPassword} onClose={() => setResetTarget(null)} />
    </div>
  );
}
