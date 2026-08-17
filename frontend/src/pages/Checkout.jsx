import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { MapPin, LocateFixed, Tag, Wallet, Smartphone, Banknote, Loader2, CalendarClock, Repeat, BadgePercent } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { zonesApi, addressesApi } from '../api/logistics';
import { ordersApi, paymentsApi } from '../api/orders';
import { couponsApi } from '../api/extras';
import { recurringOrdersApi } from '../api/recurring';
import { getUnitPriceForQuantity } from '../utils/pricing';
import { formatFCFA } from '../utils/format';
import { toast } from '../store/toastStore';
import MapView, { YAOUNDE_CENTER } from '../components/MapView';

const PAYMENT_OPTIONS = [
  { value: 'MTN_MOMO', label: 'MTN Mobile Money', icon: Smartphone },
  { value: 'ORANGE_MONEY', label: 'Orange Money', icon: Smartphone },
  { value: 'CASH', label: 'Espèces à la livraison', icon: Banknote },
];

const FREQUENCY_OPTIONS = [
  { value: 'WEEKLY', label: 'Chaque semaine' },
  { value: 'BIWEEKLY', label: 'Toutes les 2 semaines' },
  { value: 'MONTHLY', label: 'Chaque mois' },
];

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { items, subtotal, clear } = useCartStore();
  const customer = user?.customerProfile;
  const isWholesale = customer?.customerType === 'PROFESSIONNEL' && customer?.professionalStatus === 'APPROVED';

  const { register, handleSubmit, formState: { errors } } = useForm();

  const [zones, setZones] = useState([]);
  const [zoneId, setZoneId] = useState('');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [scheduleLater, setScheduleLater] = useState(false);
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [frequency, setFrequency] = useState('WEEKLY');

  useEffect(() => {
    if (items.length === 0) navigate('/panier');
  }, [items, navigate]);

  useEffect(() => {
    zonesApi.list().then((z) => {
      setZones(z);
      if (z.length) setZoneId(z[0].id);
    });
    if (user?.role === 'CUSTOMER') {
      addressesApi.list().then((addrs) => {
        setSavedAddresses(addrs);
        const def = addrs.find((a) => a.isDefault) || addrs[0];
        if (def) setSelectedAddressId(def.id);
      });
    }
  }, [user]);

  const subtotalValue = subtotal(customer);
  const zone = zones.find((z) => z.id === zoneId);
  const deliveryFee = zone?.fee || 0;
  const discount = coupon?.discount || 0;
  const total = Math.max(0, subtotalValue + deliveryFee - discount);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocating(false);
        toast.success('Position GPS enregistrée');
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  };

  const applyCoupon = async () => {
    setCouponError('');
    if (!couponCode) return;
    try {
      const result = await couponsApi.validate(couponCode, subtotalValue);
      setCoupon(result);
      toast.success(`Code ${result.code} appliqué`);
    } catch (err) {
      setCoupon(null);
      setCouponError(err.message);
    }
  };

  const onSubmit = async (data) => {
    setFormError('');
    if (!zoneId) return setFormError('Veuillez choisir une zone de livraison');
    if ((paymentMethod === 'MTN_MOMO' || paymentMethod === 'ORANGE_MONEY') && !data.paymentPhoneNumber) {
      return setFormError('Numéro de téléphone Mobile Money requis');
    }

    setSubmitting(true);
    try {
      const newAddressPayload = !selectedAddressId
        ? {
            fullName: user ? `${user.firstName} ${user.lastName}` : data.guestName,
            phone: user ? user.phone : data.guestPhone,
            district: data.district,
            landmark: data.landmark || undefined,
            instructions: data.instructions || undefined,
            latitude: coords?.latitude,
            longitude: coords?.longitude,
            saveAddress: !!(user && (data.saveAddress || makeRecurring)),
          }
        : null;

      const payload = {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        deliveryZoneId: zoneId,
        paymentMethod,
        paymentPhoneNumber: data.paymentPhoneNumber || undefined,
        couponCode: coupon ? couponCode : undefined,
        notes: data.notes || undefined,
        scheduledAt: scheduleLater && data.scheduledAt ? new Date(data.scheduledAt).toISOString() : undefined,
      };

      if (!user) {
        payload.guestName = data.guestName;
        payload.guestPhone = data.guestPhone;
      }

      if (selectedAddressId) payload.addressId = selectedAddressId;
      else payload.newAddress = newAddressPayload;

      const order = await ordersApi.create(payload);

      if (paymentMethod === 'MTN_MOMO') {
        await paymentsApi.initiateMtn(order.id, data.paymentPhoneNumber).catch(() => {});
      } else if (paymentMethod === 'ORANGE_MONEY') {
        await paymentsApi.initiateOrange(order.id, data.paymentPhoneNumber).catch(() => {});
      }

      // Commande récurrente (section 75) : cree un modele en plus de la
      // commande immediate, seulement possible pour un client connecte avec
      // une adresse identifiable (celle qui vient d'etre utilisee ou enregistree).
      if (makeRecurring && user) {
        try {
          const addressIdForRecurring = selectedAddressId || order.addressId;
          await recurringOrdersApi.create({
            label: 'Commande habituelle',
            items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
            addressId: addressIdForRecurring,
            deliveryZoneId: zoneId,
            paymentMethod,
            frequency,
          });
          toast.success('Commande récurrente programmée');
        } catch (e) {
          toast.error("La commande a été passée, mais la récurrence n'a pas pu être programmée");
        }
      }

      sessionStorage.setItem(
        'lastOrder',
        JSON.stringify({ id: order.id, orderNumber: order.orderNumber, phone: order.guestPhone || user?.phone })
      );
      clear();
      navigate(`/commande-confirmee/${order.id}`, { state: { order } });
    } catch (err) {
      setFormError(err.message || 'Impossible de créer la commande');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">Finaliser la commande</h1>
        {isWholesale && (
          <span className="badge bg-amber-100 text-amber-800">
            <BadgePercent size={13} /> Tarif pro -{customer.wholesaleDiscountPercent}%
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Contact (invité) */}
          {!user && (
            <div className="card p-5">
              <h2 className="font-display text-lg font-semibold">Vos coordonnées</h2>
              <p className="mb-4 text-sm text-ink/50">
                Commandez sans créer de compte, ou <Link to="/connexion" className="font-medium text-brand-700 hover:underline">connectez-vous</Link>.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Nom complet</label>
                  <input className="input" {...register('guestName', { required: true })} />
                  {errors.guestName && <p className="mt-1 text-xs text-red-600">Nom requis</p>}
                </div>
                <div>
                  <label className="label">Téléphone</label>
                  <input className="input" placeholder="6XXXXXXXX" {...register('guestPhone', { required: true, minLength: 8 })} />
                  {errors.guestPhone && <p className="mt-1 text-xs text-red-600">Téléphone requis</p>}
                </div>
              </div>
            </div>
          )}

          {/* Adresse */}
          <div className="card p-5">
            <h2 className="font-display text-lg font-semibold">Adresse de livraison</h2>

            {savedAddresses.length > 0 && (
              <div className="mt-4 space-y-2">
                {savedAddresses.map((a) => (
                  <label key={a.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${selectedAddressId === a.id ? 'border-brand-600 bg-brand-500/5' : 'border-line'}`}>
                    <input type="radio" className="mt-1" checked={selectedAddressId === a.id} onChange={() => setSelectedAddressId(a.id)} />
                    <span className="text-sm">
                      <span className="font-medium text-ink">{a.district}</span> — {a.fullName}, {a.phone}
                      {a.landmark && <span className="block text-ink/50">{a.landmark}</span>}
                    </span>
                  </label>
                ))}
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${!selectedAddressId ? 'border-brand-600 bg-brand-500/5' : 'border-line'}`}>
                  <input type="radio" checked={!selectedAddressId} onChange={() => setSelectedAddressId('')} />
                  <span className="text-sm font-medium text-ink">+ Utiliser une nouvelle adresse</span>
                </label>
              </div>
            )}

            {!selectedAddressId && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="label">Quartier</label>
                    <input className="input" placeholder="Ex : Essos" {...register('district', { required: true })} />
                    {errors.district && <p className="mt-1 text-xs text-red-600">Quartier requis</p>}
                  </div>
                  <div>
                    <label className="label">Point de repère (facultatif)</label>
                    <input className="input" placeholder="Ex : à côté du marché Essos" {...register('landmark')} />
                  </div>
                  <div>
                    <label className="label">Instructions (facultatif)</label>
                    <input className="input" placeholder="Ex : appelez avant d'arriver" {...register('instructions')} />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="label !mb-0">Position sur la carte (facultatif)</label>
                    <button type="button" onClick={useMyLocation} className="btn-secondary !py-1.5 text-xs">
                      {locating ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
                      Utiliser ma position GPS
                    </button>
                  </div>
                  <MapView
                    center={coords ? [coords.latitude, coords.longitude] : YAOUNDE_CENTER}
                    markers={coords ? [{ position: [coords.latitude, coords.longitude], label: 'Adresse de livraison' }] : []}
                    onPick={(c) => setCoords(c)}
                    height={220}
                  />
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-ink/45">
                    <MapPin size={12} /> {coords ? 'Position définie — cliquez à nouveau pour ajuster.' : 'Cliquez sur la carte pour placer votre position, ou utilisez le GPS.'}
                  </p>
                </div>

                {user && (
                  <label className="flex items-center gap-2 text-sm text-ink/70">
                    <input type="checkbox" {...register('saveAddress')} /> Enregistrer cette adresse pour mes prochaines commandes
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Zone de livraison */}
          <div className="card p-5">
            <h2 className="font-display text-lg font-semibold">Zone de livraison</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {zones.map((z) => (
                <label key={z.id} className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm ${zoneId === z.id ? 'border-brand-600 bg-brand-500/5' : 'border-line'}`}>
                  <span className="flex items-center gap-2 font-medium text-ink">
                    <input type="radio" checked={zoneId === z.id} onChange={() => setZoneId(z.id)} /> {z.name}
                  </span>
                  <span className="text-ink/60">{formatFCFA(z.fee)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Quand livrer (section 17) */}
          <div className="card p-5">
            <h2 className="font-display text-lg font-semibold">Quand souhaitez-vous être livré ?</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-medium ${!scheduleLater ? 'border-brand-600 bg-brand-500/5 text-ink' : 'border-line text-ink/70'}`}>
                <input type="radio" checked={!scheduleLater} onChange={() => setScheduleLater(false)} /> Livraison immédiate
              </label>
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-medium ${scheduleLater ? 'border-brand-600 bg-brand-500/5 text-ink' : 'border-line text-ink/70'}`}>
                <input type="radio" checked={scheduleLater} onChange={() => setScheduleLater(true)} /> <CalendarClock size={15} /> Programmer
              </label>
            </div>
            {scheduleLater && (
              <div className="mt-3">
                <input type="datetime-local" className="input max-w-xs" {...register('scheduledAt')} />
              </div>
            )}

            {user && (
              <div className="mt-4 border-t border-line pt-4">
                <label className="flex items-center gap-2 text-sm font-medium text-ink">
                  <input type="checkbox" checked={makeRecurring} onChange={(e) => setMakeRecurring(e.target.checked)} />
                  <Repeat size={15} /> Faire de cette commande une commande habituelle
                </label>
                {makeRecurring && (
                  <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="input mt-2 max-w-xs !py-2 text-sm">
                    {FREQUENCY_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Paiement */}
          <div className="card p-5">
            <h2 className="font-display text-lg font-semibold">Mode de paiement</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {PAYMENT_OPTIONS.map(({ value, label, icon: Icon }) => (
                <label key={value} className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 text-center text-sm ${paymentMethod === value ? 'border-brand-600 bg-brand-500/5' : 'border-line'}`}>
                  <input type="radio" className="sr-only" checked={paymentMethod === value} onChange={() => setPaymentMethod(value)} />
                  <Icon size={20} className={paymentMethod === value ? 'text-brand-700' : 'text-ink/50'} />
                  <span className="font-medium text-ink">{label}</span>
                </label>
              ))}
            </div>
            {(paymentMethod === 'MTN_MOMO' || paymentMethod === 'ORANGE_MONEY') && (
              <div className="mt-4">
                <label className="label">Numéro Mobile Money</label>
                <input className="input max-w-xs" placeholder="6XXXXXXXX" {...register('paymentPhoneNumber')} />
                <p className="mt-1 text-xs text-ink/45">Vous recevrez une demande de confirmation sur ce numéro.</p>
              </div>
            )}
          </div>
        </div>

        {/* Récapitulatif */}
        <aside className="h-fit space-y-4 lg:sticky lg:top-20">
          <div className="card p-5">
            <h2 className="font-display text-lg font-semibold">Récapitulatif</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {items.map((i) => (
                <li key={i.productId} className="flex justify-between text-ink/70">
                  <span>{i.name} × {i.quantity}</span>
                  <span>{formatFCFA(Math.round(getUnitPriceForQuantity(i, i.quantity, customer) * i.quantity))}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex gap-2">
              <input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Code promo"
                className="input flex-1 !py-2 text-sm"
              />
              <button type="button" onClick={applyCoupon} className="btn-secondary !px-3 !py-2 text-sm">
                <Tag size={15} />
              </button>
            </div>
            {couponError && <p className="mt-1 text-xs text-red-600">{couponError}</p>}
            {coupon && <p className="mt-1 text-xs text-brand-700">Code {coupon.code} appliqué : -{formatFCFA(coupon.discount)}</p>}

            <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
              <div className="flex justify-between text-ink/60"><span>Sous-total</span><span>{formatFCFA(subtotalValue)}</span></div>
              <div className="flex justify-between text-ink/60"><span>Livraison</span><span>{formatFCFA(deliveryFee)}</span></div>
              {discount > 0 && <div className="flex justify-between text-brand-700"><span>Réduction</span><span>-{formatFCFA(discount)}</span></div>}
              <div className="flex justify-between border-t border-line pt-2 font-display text-base font-bold text-ink"><span>Total</span><span>{formatFCFA(total)}</span></div>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

            <button type="submit" disabled={submitting} className="btn-primary mt-5 w-full">
              {submitting ? <Loader2 size={17} className="animate-spin" /> : <Wallet size={17} />}
              {submitting ? 'Traitement...' : 'Confirmer la commande'}
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
}
