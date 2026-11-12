import { useEffect, useState } from 'react';
import { Gift, Copy, MessageCircle, Users } from 'lucide-react';
import { customersApi } from '../../api/customers';
import AccountBack from '../../components/AccountBack';
import Loader from '../../components/Loader';
import { toast } from '../../store/toastStore';

export default function Referral() {
  const [data, setData] = useState(null);

  useEffect(() => {
    customersApi.myReferral().then(setData).catch(() => setData(null));
  }, []);

  if (!data) return <Loader />;

  const shareMessage = `Salut ! Je te recommande Fresh Fish pour du silure frais et des alevins livrés à Yaoundé 🐟. Utilise mon code ${data.referralCode} lors de ton inscription : ${window.location.origin}/inscription`;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

  const copyCode = () => {
    navigator.clipboard.writeText(data.referralCode);
    toast.success('Code copié');
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Parrainage</h1>
      <AccountBack />

      <div className="card overflow-hidden">
        <div className="bg-pine-900 p-6 text-center text-white">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <Gift size={22} className="text-brand-500" />
          </span>
          <h2 className="mt-3 font-display text-lg font-bold">Parrainez vos proches</h2>
          <p className="mt-1 text-sm text-white/60">Gagnez 50 points de fidélité dès leur première commande livrée.</p>
        </div>

        <div className="p-6">
          <p className="label">Votre code de parrainage</p>
          <div className="flex items-center gap-2">
            <p className="flex-1 rounded-lg border border-line bg-mist px-4 py-3 text-center font-display text-xl font-bold tracking-widest text-ink">
              {data.referralCode}
            </p>
            <button onClick={copyCode} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line text-ink/60 hover:bg-mist" title="Copier">
              <Copy size={18} />
            </button>
          </div>

          <a href={whatsappShareUrl} target="_blank" rel="noreferrer" className="btn-primary mt-4 w-full">
            <MessageCircle size={17} /> Partager sur WhatsApp
          </a>

          <div className="mt-6 flex items-center gap-3 border-t border-line pt-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10 text-brand-700">
              <Users size={17} />
            </span>
            <div>
              <p className="font-display font-semibold text-ink">{data.referralsCount} filleul(s)</p>
              <p className="text-xs text-ink/50">inscrit(s) avec votre code</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
