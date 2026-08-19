import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function AdminLogin() {
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
      if (user.role !== 'ADMIN') {
        setError("Ce compte n'a pas accès à l'administration");
        return;
      }
      navigate('/admin');
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
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white p-2"><img src="/brand/logo-icon-raw.png" alt="" className="h-full w-full object-contain" /></span>
          <h1 className="mt-3 font-display text-xl font-bold">Administration</h1>
          <p className="text-sm text-white/40">NONO SMART SARL</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl2 bg-white p-6">
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
      </div>
    </div>
  );
}
