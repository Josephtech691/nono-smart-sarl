import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function Login() {
  const { register, handleSubmit } = useForm();
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setError('');
    setLoading(true);
    try {
      const user = await login(data);
      if (user.role === 'ADMIN') navigate('/admin');
      else if (user.role === 'DRIVER') navigate('/livreur');
      else navigate(location.state?.from?.pathname || '/compte/commandes');
    } catch (err) {
      setError(err.message || 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <h1 className="text-center text-2xl font-bold">Connexion</h1>
      <p className="mt-1 text-center text-ink/60">Accédez à vos commandes et vos adresses.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="card mt-6 space-y-4 p-6">
        <div>
          <label className="label">Téléphone ou email</label>
          <input className="input" {...register('phone', { required: true })} />
        </div>
        <div>
          <label className="label">Mot de passe</label>
          <input type="password" className="input" {...register('password', { required: true })} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          <LogIn size={17} /> {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink/60">
        Pas encore de compte ? <Link to="/inscription" className="font-semibold text-brand-700 hover:underline">Créer un compte</Link>
      </p>
      <p className="mt-2 text-center text-sm text-ink/60">
        Ou <Link to="/checkout" className="font-semibold text-brand-700 hover:underline">commandez sans compte</Link>
      </p>
    </div>
  );
}
