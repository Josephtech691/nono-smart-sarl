import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Phone, Plus, Power, RefreshCw, Truck } from 'lucide-react';
import { driversApi } from '../../api/logistics';
import EmptyState from '../../components/EmptyState';
import { RowSkeleton } from '../../components/Skeleton';
import Modal from '../../components/admin/Modal';
import ResetPasswordModal from '../../components/admin/ResetPasswordModal';
import SearchBox from '../../components/admin/SearchBox';
import TabBar from '../../components/admin/TabBar';
import useAdminList from '../../hooks/useAdminList';
import useUrlFilters from '../../hooks/useUrlFilters';
import { toast } from '../../store/toastStore';
import { formatPhone, toLocalPhone } from '../../utils/format';
import { generatePassword } from '../../utils/password';
import usePageMeta from '../../utils/usePageMeta';

const REFRESH_MS = 60000;
const DEFAULTS = { statut: '', q: '' };

const STATUS_LABELS = { AVAILABLE: 'Disponible', BUSY: 'Occupé', OFFLINE: 'Hors ligne', SUSPENDED: 'Suspendu' };
const STATUS_STYLES = {
  AVAILABLE: 'bg-brand-500/15 text-brand-700',
  BUSY: 'bg-amber-100 text-amber-800',
  OFFLINE: 'bg-mist text-ink/60',
  SUSPENDED: 'bg-red-100 text-red-700',
};

const TABS = [
  { value: '', label: 'Tous' },
  { value: 'AVAILABLE', label: 'Disponibles' },
  { value: 'BUSY', label: 'Occupés' },
  { value: 'OFFLINE', label: 'Hors ligne' },
  { value: 'SUSPENDED', label: 'Suspendus' },
];

const EMPTY_FORM = { firstName: '', lastName: '', phone: '', email: '', password: '', vehicle: '' };
// Champs du formulaire d'ajout : l'ordre est celui de l'écran (le focus va au premier champ invalide).
const FIELD_IDS = {
  firstName: 'driver-first-name',
  lastName: 'driver-last-name',
  phone: 'driver-phone',
  email: 'driver-email',
  password: 'driver-password',
};

const fullName = (driver) => `${driver.user.firstName} ${driver.user.lastName}`.trim();
const knownStatus = (value) => (STATUS_LABELS[value] ? value : '');
const normalize = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Recherche par nom, téléphone ou véhicule : tous les mots saisis doivent se retrouver (« jean 699 » trouve Jean, 699 12 34 56).
function matchesSearch(driver, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = normalize(`${fullName(driver)} ${driver.user.phone} ${toLocalPhone(driver.user.phone)} ${driver.vehicle || ''}`);
  return terms.every((term) => haystack.includes(term));
}

function validateForm(form) {
  const errors = {};
  if (form.firstName.trim().length < 2) errors.firstName = 'Au moins 2 caractères.';
  if (form.lastName.trim().length < 2) errors.lastName = 'Au moins 2 caractères.';
  if (!/^\d{9}$/.test(toLocalPhone(form.phone))) errors.phone = 'Numéro à 9 chiffres, par exemple 6 99 12 34 56.';
  if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Adresse email invalide.';
  if (form.password.length < 6) errors.password = 'Au moins 6 caractères.';
  return errors;
}

function StatusSelect({ driver, value, disabled, onChange }) {
  return (
    <select
      aria-label={`Statut de ${fullName(driver)}`}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(driver, e.target.value)}
      className={`cursor-pointer rounded-full border-0 py-1.5 pl-3 pr-7 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-wait disabled:opacity-60 ${STATUS_STYLES[value] || ''}`}
    >
      {Object.entries(STATUS_LABELS).map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

function Workload({ driver }) {
  const s = driver.stats || {};
  const delivered = s.delivered || 0;
  const failed = s.failed || 0;
  return (
    <div className="text-sm">
      <Link to={`/admin/livraisons?livreur=${driver.id}`} title={`Voir les livraisons de ${fullName(driver)}`} className="font-semibold text-ink hover:text-brand-700 hover:underline">
        {delivered} livrée{delivered > 1 ? 's' : ''}
      </Link>
      {s.deliveredToday > 0 && <span className="text-xs text-brand-700"> · {s.deliveredToday} aujourd’hui</span>}
      <p className="text-xs text-ink/55">
        {s.todo || 0} à faire · {s.active || 0} en cours
        {failed > 0 && <span className="font-medium text-red-600"> · {failed} échec{failed > 1 ? 's' : ''}</span>}
      </p>
    </div>
  );
}

function Actions({ driver, busy, onReset, onToggle }) {
  const active = driver.user.isActive;
  const name = fullName(driver);
  return (
    <div className="flex flex-wrap items-center gap-2 md:justify-end">
      <button type="button" data-action="reset" onClick={() => onReset(driver)} aria-label={`Réinitialiser le mot de passe de ${name}`} className="btn-secondary !px-3 !py-1.5 text-xs">
        <KeyRound size={14} aria-hidden="true" /> Mot de passe
      </button>
      <button
        type="button"
        data-action="toggle"
        onClick={() => onToggle(driver)}
        disabled={busy}
        aria-label={`${active ? 'Désactiver' : 'Réactiver'} le compte de ${name}`}
        className={`btn-secondary !px-3 !py-1.5 text-xs ${active ? '!text-red-700 hover:!bg-red-50' : ''}`}
      >
        <Power size={14} aria-hidden="true" /> {active ? 'Désactiver' : 'Réactiver'}
      </button>
    </div>
  );
}

function PhoneLink({ driver }) {
  const phone = driver.user.phone;
  if (!phone) return <span className="text-ink/40">—</span>;
  return (
    <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 text-ink/80 hover:text-brand-700 hover:underline">
      <Phone size={13} className="text-ink/40" aria-hidden="true" /> {formatPhone(phone)}
    </a>
  );
}

function Field({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-ink/50">{hint}</p>
      )}
    </div>
  );
}

function AddDriverModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  const close = () => {
    if (busy) return;
    setForm(EMPTY_FORM);
    setErrors({});
    setServerError('');
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = validateForm(form);
    setErrors(found);
    setServerError('');
    const firstInvalid = Object.keys(FIELD_IDS).find((key) => found[key]);
    if (firstInvalid) {
      document.getElementById(FIELD_IDS[firstInvalid])?.focus();
      return;
    }

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: toLocalPhone(form.phone),
      password: form.password,
    };
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.vehicle.trim()) payload.vehicle = form.vehicle.trim();

    setBusy(true);
    try {
      const created = await driversApi.create(payload);
      const credentials = { target: { id: created.id, name: `${payload.firstName} ${payload.lastName}`, phone: payload.phone }, password: payload.password };
      setForm(EMPTY_FORM);
      setErrors({});
      onCreated(credentials);
    } catch (err) {
      // Le serveur a refusé des champs que la vérification locale laisse passer : on les signale un par un.
      const rejected = Array.isArray(err.details) ? err.details.map((d) => d.field).filter((field) => FIELD_IDS[field]) : [];
      if (rejected.length) {
        setErrors(Object.fromEntries(rejected.map((field) => [field, 'Valeur refusée.'])));
        setServerError('Vérifiez les champs signalés.');
      } else {
        setServerError(err.message || 'Création impossible, réessayez.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} busy={busy} icon={Truck} title="Ajouter un livreur" description="Le téléphone sert d’identifiant de connexion. Vous transmettez ensuite ses accès au livreur.">
      <form onSubmit={submit} noValidate className="mt-4 grid gap-3.5 sm:grid-cols-2">
        <Field id="driver-first-name" label="Prénom" error={errors.firstName}>
          <input id="driver-first-name" className="input" value={form.firstName} onChange={set('firstName')} autoComplete="off" aria-invalid={Boolean(errors.firstName)} data-autofocus />
        </Field>
        <Field id="driver-last-name" label="Nom" error={errors.lastName}>
          <input id="driver-last-name" className="input" value={form.lastName} onChange={set('lastName')} autoComplete="off" aria-invalid={Boolean(errors.lastName)} />
        </Field>
        <Field id="driver-phone" label="Téléphone" error={errors.phone}>
          <input id="driver-phone" className="input" type="tel" inputMode="tel" placeholder="6 99 12 34 56" value={form.phone} onChange={set('phone')} autoComplete="off" aria-invalid={Boolean(errors.phone)} />
        </Field>
        <Field id="driver-vehicle" label="Véhicule (facultatif)">
          <input id="driver-vehicle" className="input" list="driver-vehicles" placeholder="Moto" value={form.vehicle} onChange={set('vehicle')} autoComplete="off" maxLength={60} />
          <datalist id="driver-vehicles">
            <option value="Moto" />
            <option value="Voiture" />
            <option value="Tricycle" />
            <option value="Vélo" />
          </datalist>
        </Field>
        <div className="sm:col-span-2">
          <Field id="driver-email" label="Email (facultatif)" error={errors.email}>
            <input id="driver-email" className="input" type="email" inputMode="email" value={form.email} onChange={set('email')} autoComplete="off" aria-invalid={Boolean(errors.email)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id="driver-password" label="Mot de passe provisoire" error={errors.password} hint="Il le changera depuis son profil. Notez-le : il ne sera plus affiché ensuite.">
            <div className="flex gap-2">
              <input id="driver-password" className="input font-mono" value={form.password} onChange={set('password')} autoComplete="new-password" spellCheck={false} aria-invalid={Boolean(errors.password)} />
              <button
                type="button"
                onClick={() => {
                  setForm((f) => ({ ...f, password: generatePassword() }));
                  setErrors((current) => ({ ...current, password: undefined }));
                }}
                className="btn-secondary shrink-0 !px-3.5 text-sm"
              >
                <RefreshCw size={15} aria-hidden="true" /> Générer
              </button>
            </div>
          </Field>
        </div>
        {serverError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
            {serverError}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:col-span-2">
          <button type="button" onClick={close} disabled={busy} className="btn-secondary !py-3">
            Annuler
          </button>
          <button type="submit" disabled={busy} className="btn-primary !py-3">
            {busy ? 'Création…' : 'Créer le compte'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminDrivers() {
  usePageMeta('Livreurs');
  const [filters, setFilters] = useUrlFilters(DEFAULTS);
  const { data, loading, error, reload } = useAdminList(() => driversApi.list(), {}, { refreshMs: REFRESH_MS });

  const [adding, setAdding] = useState(false);
  const [reveal, setReveal] = useState(null); // { target, password? } : fenêtre « mot de passe provisoire » / « compte créé »
  const [confirm, setConfirm] = useState(null); // livreur dont on s'apprête à désactiver le compte
  const [pendingStatus, setPendingStatus] = useState({}); // id -> statut en cours d'enregistrement (affiché tout de suite)
  const [busyIds, setBusyIds] = useState({});

  const status = knownStatus(filters.statut);
  const drivers = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    // Ordre stable (nom), comptes désactivés en dernier : une ligne ne saute pas quand on change son statut.
    return [...list].sort((a, b) => Number(b.user.isActive) - Number(a.user.isActive) || fullName(a).localeCompare(fullName(b), 'fr'));
  }, [data]);

  const searched = useMemo(() => drivers.filter((d) => matchesSearch(d, filters.q)), [drivers, filters.q]);
  const visible = status ? searched.filter((d) => d.status === status) : searched;
  const tabs = TABS.map((t) => ({ ...t, count: data ? (t.value ? searched.filter((d) => d.status === t.value).length : searched.length) : undefined }));
  const hasFilters = Boolean(filters.q || status);

  const markBusy = (id, on) => setBusyIds((current) => ({ ...current, [id]: on }));

  const changeStatus = async (driver, next) => {
    if (next === driver.status) return;
    setPendingStatus((current) => ({ ...current, [driver.id]: next }));
    markBusy(driver.id, true);
    try {
      await driversApi.update(driver.id, { status: next });
      await reload({ silent: true });
      toast.success(`${fullName(driver)} : ${STATUS_LABELS[next].toLowerCase()}`);
    } catch (err) {
      toast.error(err.message || 'Changement de statut impossible.');
    } finally {
      setPendingStatus((current) => {
        const { [driver.id]: _removed, ...rest } = current;
        return rest;
      });
      markBusy(driver.id, false);
    }
  };

  const setActive = async (target, isActive) => {
    markBusy(target.id, true);
    try {
      await driversApi.update(target.id, { isActive });
      await reload({ silent: true });
      toast.success(isActive ? `Compte de ${target.name} réactivé.` : `Compte de ${target.name} désactivé.`);
      setConfirm(null);
    } catch (err) {
      toast.error(err.message || 'Modification du compte impossible.');
    } finally {
      markBusy(target.id, false);
    }
  };

  const askToggle = (driver) => {
    const target = { id: driver.id, name: fullName(driver), workload: (driver.stats?.todo || 0) + (driver.stats?.active || 0) };
    // Réactiver ne demande pas de confirmation ; désactiver coupe l'accès tout de suite, on confirme.
    if (!driver.user.isActive) setActive(target, true);
    else setConfirm(target);
  };

  const openReset = (driver) => setReveal({ target: { id: driver.id, name: fullName(driver), phone: driver.user.phone } });
  const clearFilters = () => setFilters({ q: '', statut: '' });

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Livreurs</h1>
          <p className="text-sm text-ink/55">Disponibilité, livraisons effectuées et accès au compte de chaque livreur.</p>
        </div>
        <button type="button" onClick={() => setAdding(true)} className="btn-primary !py-2.5 text-sm" data-testid="add-driver">
          <Plus size={16} aria-hidden="true" /> Ajouter un livreur
        </button>
      </div>

      <div className="mt-5">
        <TabBar tabs={tabs} value={status} onChange={(value) => setFilters({ statut: value })} label="Livreurs par statut" />
      </div>
      <div className="mt-4 max-w-md">
        <SearchBox value={filters.q} onSearch={(q) => setFilters({ q })} placeholder="Rechercher : nom, téléphone, véhicule…" label="Rechercher un livreur" />
      </div>

      <div className={`mt-5 transition-opacity ${loading && data ? 'opacity-60' : ''}`} aria-busy={loading}>
        {error && !data ? (
          <EmptyState
            icon={Truck}
            title="Chargement impossible"
            description={error}
            action={
              <button type="button" onClick={() => reload()} className="btn-primary mt-2">
                Réessayer
              </button>
            }
          />
        ) : !data ? (
          <RowSkeleton count={4} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={hasFilters ? 'Aucun livreur trouvé' : 'Aucun livreur pour le moment'}
            description={hasFilters ? 'Aucun livreur ne correspond à cette recherche.' : 'Ajoutez votre premier livreur pour lui confier des livraisons.'}
            action={
              hasFilters ? (
                <button type="button" onClick={clearFilters} className="btn-secondary mt-2 !px-4 !py-2 text-sm">
                  Effacer les filtres
                </button>
              ) : (
                <button type="button" onClick={() => setAdding(true)} className="btn-primary mt-2">
                  <Plus size={16} aria-hidden="true" /> Ajouter un livreur
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="card hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-left text-sm" data-testid="drivers-table">
                <thead className="border-b border-line bg-mist/60 text-xs uppercase tracking-wide text-ink/50">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Livreur</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Téléphone</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Statut</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Livraisons</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((d) => (
                    <tr key={d.id} className={`transition hover:bg-mist/40 ${d.user.isActive ? '' : 'bg-mist/30'}`} data-driver={fullName(d)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine-900/10 text-pine-900" aria-hidden="true">
                            <Truck size={16} />
                          </span>
                          <div className="min-w-0">
                            <p className={`font-semibold ${d.user.isActive ? 'text-ink' : 'text-ink/50'}`}>{fullName(d)}</p>
                            <p className="text-xs text-ink/50">
                              {d.vehicle || 'Véhicule non renseigné'}
                              {!d.user.isActive && <span className="ml-1.5 font-semibold text-red-600">· Compte désactivé</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <PhoneLink driver={d} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusSelect driver={d} value={pendingStatus[d.id] || d.status} disabled={Boolean(busyIds[d.id])} onChange={changeStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <Workload driver={d} />
                      </td>
                      <td className="px-4 py-3">
                        <Actions driver={d} busy={Boolean(busyIds[d.id])} onReset={openReset} onToggle={askToggle} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 md:hidden" data-testid="drivers-cards">
              {visible.map((d) => (
                <li key={d.id} className={`card p-4 ${d.user.isActive ? '' : 'bg-mist/40'}`} data-driver={fullName(d)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pine-900/10 text-pine-900" aria-hidden="true">
                        <Truck size={17} />
                      </span>
                      <div className="min-w-0">
                        <p className={`truncate font-semibold ${d.user.isActive ? 'text-ink' : 'text-ink/50'}`}>{fullName(d)}</p>
                        <p className="truncate text-xs text-ink/50">
                          {d.vehicle || 'Véhicule non renseigné'}
                          {!d.user.isActive && <span className="ml-1.5 font-semibold text-red-600">· Compte désactivé</span>}
                        </p>
                      </div>
                    </div>
                    <StatusSelect driver={d} value={pendingStatus[d.id] || d.status} disabled={Boolean(busyIds[d.id])} onChange={changeStatus} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
                    <div>
                      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink/40">Téléphone</p>
                      <PhoneLink driver={d} />
                    </div>
                    <div>
                      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink/40">Livraisons</p>
                      <Workload driver={d} />
                    </div>
                  </div>
                  <div className="mt-3 border-t border-line pt-3">
                    <Actions driver={d} busy={Boolean(busyIds[d.id])} onReset={openReset} onToggle={askToggle} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <AddDriverModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(credentials) => {
          setAdding(false);
          setReveal(credentials);
          reload({ silent: true });
        }}
      />

      <ResetPasswordModal
        target={reveal?.target ?? null}
        initialPassword={reveal?.password ?? ''}
        kind="driver"
        reset={driversApi.resetPassword}
        onClose={() => setReveal(null)}
      />

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        busy={Boolean(confirm && busyIds[confirm.id])}
        icon={Power}
        title="Désactiver ce compte ?"
        description={confirm ? `${confirm.name} ne pourra plus se connecter ni recevoir de nouvelle livraison. Vous pourrez réactiver son compte à tout moment.` : ''}
      >
        {confirm?.workload > 0 && (
          <p role="alert" className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Il a encore {confirm.workload} livraison{confirm.workload > 1 ? 's' : ''} à faire ou en cours : réassignez-les depuis la page{' '}
            <Link to={`/admin/livraisons?livreur=${confirm.id}`} className="font-semibold underline">
              Livraisons
            </Link>
            .
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setConfirm(null)} disabled={Boolean(confirm && busyIds[confirm.id])} className="btn-secondary !py-3" data-autofocus>
            Annuler
          </button>
          <button
            type="button"
            onClick={() => confirm && setActive(confirm, false)}
            disabled={Boolean(confirm && busyIds[confirm.id])}
            className="btn-primary !bg-red-600 !py-3 hover:!bg-red-700"
            data-testid="confirm-deactivate"
          >
            {confirm && busyIds[confirm.id] ? 'Désactivation…' : 'Désactiver'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
