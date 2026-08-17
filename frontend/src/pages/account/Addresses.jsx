import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { MapPin, Plus, Trash2, Star } from 'lucide-react';
import { addressesApi } from '../../api/logistics';
import AccountNav from '../../components/AccountNav';
import EmptyState from '../../components/EmptyState';
import Loader from '../../components/Loader';

export default function Addresses() {
  const [addresses, setAddresses] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const load = () => addressesApi.list().then(setAddresses).catch(() => setAddresses([]));

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (data) => {
    await addressesApi.create(data);
    reset();
    setShowForm(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm('Supprimer cette adresse ?')) return;
    await addressesApi.remove(id);
    load();
  };

  const makeDefault = async (id) => {
    await addressesApi.update(id, { isDefault: true });
    load();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Mon compte</h1>
      <AccountNav />

      <div className="mb-4 flex justify-end">
        <button onClick={() => setShowForm((s) => !s)} className="btn-secondary !py-2 text-sm">
          <Plus size={15} /> Nouvelle adresse
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="card mb-6 grid gap-3 p-5 sm:grid-cols-2">
          <div>
            <label className="label">Nom complet</label>
            <input className="input" {...register('fullName', { required: true })} />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input className="input" {...register('phone', { required: true })} />
          </div>
          <div>
            <label className="label">Quartier</label>
            <input className="input" {...register('district', { required: true })} />
          </div>
          <div>
            <label className="label">Point de repère</label>
            <input className="input" {...register('landmark')} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Instructions</label>
            <input className="input" {...register('instructions')} />
          </div>
          <button type="submit" className="btn-primary sm:col-span-2">Enregistrer l'adresse</button>
        </form>
      )}

      {addresses === null ? (
        <Loader />
      ) : addresses.length === 0 ? (
        <EmptyState icon={MapPin} title="Aucune adresse enregistrée" description="Ajoutez une adresse pour accélérer vos prochaines commandes." />
      ) : (
        <div className="space-y-3">
          {addresses.map((a) => (
            <div key={a.id} className="card flex items-center justify-between p-4">
              <div className="text-sm">
                <p className="font-semibold text-ink">
                  {a.district} {a.isDefault && <span className="badge ml-1 bg-brand-500/15 text-brand-700">Par défaut</span>}
                </p>
                <p className="text-ink/50">{a.fullName} · {a.phone}</p>
                {a.landmark && <p className="text-ink/50">{a.landmark}</p>}
              </div>
              <div className="flex items-center gap-1">
                {!a.isDefault && (
                  <button onClick={() => makeDefault(a.id)} className="flex h-9 w-9 items-center justify-center rounded-full text-ink/40 hover:bg-mist hover:text-amber-500" title="Définir par défaut">
                    <Star size={16} />
                  </button>
                )}
                <button onClick={() => remove(a.id)} className="flex h-9 w-9 items-center justify-center rounded-full text-ink/40 hover:bg-red-50 hover:text-red-600" title="Supprimer">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
