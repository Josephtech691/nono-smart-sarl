import { useEffect, useState } from 'react';
import { Plus, Truck } from 'lucide-react';
import { driversApi } from '../../api/logistics';
import Loader from '../../components/Loader';

const STATUS_STYLES = {
  AVAILABLE: 'bg-brand-500/15 text-brand-700',
  BUSY: 'bg-amber-100 text-amber-800',
  OFFLINE: 'bg-mist text-ink/50',
  SUSPENDED: 'bg-red-100 text-red-700',
};

const STATUS_LABELS = { AVAILABLE: 'Disponible', BUSY: 'Occupé', OFFLINE: 'Hors ligne', SUSPENDED: 'Suspendu' };

const EMPTY_FORM = { firstName: '', lastName: '', phone: '', email: '', password: '', vehicle: '' };

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const load = () => driversApi.list().then(setDrivers);

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await driversApi.create(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateStatus = async (id, status) => {
    await driversApi.update(id, { status });
    load();
  };

  const toggleActive = async (driver) => {
    await driversApi.update(driver.id, { isActive: !driver.user.isActive });
    load();
  };

  if (drivers === null) return <Loader />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Livreurs</h1>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary !py-2 text-sm"><Plus size={16} /> Nouveau livreur</button>
      </div>

      {showForm && (
        <form onSubmit={save} className="card mt-4 grid gap-3 p-5 sm:grid-cols-2">
          <input className="input" placeholder="Prénom" required value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
          <input className="input" placeholder="Nom" required value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
          <input className="input" placeholder="Téléphone" required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <input className="input" placeholder="Email (facultatif)" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <input className="input" placeholder="Mot de passe" type="password" required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          <input className="input" placeholder="Véhicule (ex: Moto)" value={form.vehicle} onChange={(e) => setForm((f) => ({ ...f, vehicle: e.target.value }))} />
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <button type="submit" className="btn-primary sm:col-span-2">Créer le compte livreur</button>
        </form>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {drivers.map((d) => (
          <div key={d.id} className="card p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-pine-900/10 text-pine-900"><Truck size={17} /></span>
              <div>
                <p className="font-semibold text-ink">{d.user.firstName} {d.user.lastName}</p>
                <p className="text-xs text-ink/50">{d.user.phone} · {d._count?.deliveries ?? 0} livraisons</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={d.status}
                onChange={(e) => updateStatus(d.id, e.target.value)}
                className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[d.status]}`}
              >
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button onClick={() => toggleActive(d)} className="text-xs font-medium text-ink/50 hover:underline">
                {d.user.isActive ? 'Désactiver le compte' : 'Réactiver le compte'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
