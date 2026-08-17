import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function Register() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const registerUser = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setError('');
    setLoading(true);
    try {
      await registerUser(data);
      navigate('/compte/commandes');
    } catch (err) {
      setError(err.message || 'Inscription impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <h1 className="text-center text-2xl font-bold">Créer un compte</h1>
      <p className="mt-1 text-center text-ink/60">Suivez vos commandes et gagnez des points de fidélité.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="card mt-6 space-y-4 p-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Prénom</label>
            <input className="input" {...register('firstName', { required: true, minLength: 2 })} />
          </div>
          <div>
            <label className="label">Nom</label>
            <input className="input" {...register('lastName', { required: true, minLength: 2 })} />
          </div>
        </div>
        <div>
          <label className="label">Téléphone</label>
          <input className="input" placeholder="6XXXXXXXX" {...register('phone', { required: true, minLength: 8 })} />
        </div>
        <div>
          <label className="label">Email (facultatif)</label>
          <input type="email" className="input" {...register('email')} />
        </div>
        <div>
          <label className="label">Mot de passe</label>
          <input type="password" className="input" {...register('password', { required: true, minLength: 6 })} />
          {errors.password && <p className="mt-1 text-xs text-red-600">6 caractères minimum</p>}
        </div>
        <div>
          <label className="label">Code de parrainage (facultatif)</label>
          <input className="input" placeholder="Ex : AMI1234" {...register('referralCode')} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          <UserPlus size={17} /> {loading ? 'Création...' : 'Créer mon compte'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink/60">
        Déjà un compte ? <Link to="/connexion" className="font-semibold text-brand-700 hover:underline">Se connecter</Link>
      </p>
    </div>
  );
}
