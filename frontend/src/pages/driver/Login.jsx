import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Truck, LogIn } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function DriverLogin() {
  const { register, handleSubmit } = useForm();
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setError('');
    setLoading(true);
    try {
      const user = await login(data);
      if (user.role !== 'DRIVER') {
        setError("Ce compte n'est pas un compte livreur");
        return;
      }
      navigate('/livreur');
    } catch (err) {
      setError(err.message || 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-pine-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-white">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600"><Truck size={22} /></span>
          <h1 className="mt-3 font-display text-xl font-bold">Espace livreur</h1>
          <p className="text-sm text-white/40">NONO SMART SARL</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl2 bg-white p-6">
          <div>
            <label className="label">Téléphone</label>
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
      </div>
    </div>
  );
}
