import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  MapPin, LocateFixed, Tag, Loader2, CalendarClock, Repeat, BadgePercent, ArrowRight, ArrowLeft,
  Truck, Lock, Banknote, Pencil, Wallet, Fish, X, AlertTriangle, FlaskConical,
} from 'lucide-react';
import usePaymentConfig from '../hooks/usePaymentConfig';
import { PaymentLogo } from '../components/PaymentLogos';
import { useCartStore, lineKey, orderLines } from '../store/cartStore';
import { usePricesStore } from '../store/pricesStore';
import { useAuthStore } from '../store/authStore';
import { addressesApi } from '../api/logistics';
import { ordersApi, paymentsApi } from '../api/orders';
import { couponsApi } from '../api/extras';
import { recurringOrdersApi } from '../api/recurring';
import { getUnitPriceForQuantity } from '../utils/pricing';
import { formatFCFA, formatQuantity, toInternationalPhone, toLocalPhone, UNIT_LABELS } from '../utils/format';
import { toast } from '../store/toastStore';
import usePageMeta from '../utils/usePageMeta';
import { FLAT_DELIVERY_FEE } from '../config';
import MapView, { YAOUNDE_CENTER } from '../components/MapView';
import CheckoutStepper from '../components/CheckoutStepper';

const PENDING_PHONE_PREFIX = 'google-pending-';

const PAYMENT_OPTIONS = [
  {
    value: 'MTN_MOMO',
    label: 'MTN Mobile Money',
    hint: 'Vous validez avec votre code PIN sur votre téléphone',
  },
  {
    value: 'ORANGE_MONEY',
    label: 'Orange Money',
    hint: 'Vous serez redirigé vers Orange Money pour valider',
  },
  {
    value: 'CASH',
    label: 'Espèces à la livraison',
    hint: 'Vous réglez le livreur à la réception',
  },
];


const FREQUENCY_OPTIONS = [
  { value: 'WEEKLY', label: 'Chaque semaine' },
  { value: 'BIWEEKLY', label: 'Toutes les 2 semaines' },
  { value: 'MONTHLY', label: 'Chaque mois' },
];

// Creneaux de livraison proposes pour une commande programmee. L'heure de
// debut du creneau est enregistree dans `scheduledAt` ; le libelle complet est
// repris dans les notes de la commande pour l'equipe et le livreur.
const DELIVERY_SLOTS = [
  { value: 'MORNING', label: 'Matin', range: '8h – 12h', startHour: 8 },
  { value: 'AFTERNOON', label: 'Après-midi', range: '12h – 16h', startHour: 12 },
  { value: 'EVENING', label: 'Fin de journée', range: '16h – 19h', startHour: 16 },
];
const MIN_LEAD_MS = 60 * 60 * 1000; // un creneau doit commencer dans plus d'1 h
const MAX_SCHEDULE_DAYS = 30;

const isWeight = (unit) => unit === 'KILOGRAM' || unit === 'GRAM';
const qtyLabel = (item) =>
  `${formatQuantity(item.quantity, item.unit)}${isWeight(item.unit) ? '' : ` ${UNIT_LABELS[item.unit] || ''}`}`.trim();

// "+237 6 59 10 30 00" / "237659103000" / "659103000" -> "659103000"
const normalizeMsisdn = (value) => toLocalPhone(value);
const isContactPhone = (value) => /^[236]\d{8}$/.test(normalizeMsisdn(value));
const isMobileMoneyPhone = (value) => /^6\d{8}$/.test(normalizeMsisdn(value));

const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
};
const slotStart = (dateStr, slot) => new Date(`${dateStr}T${pad(slot.startHour)}:00:00`);
const slotAvailable = (dateStr, slot) => !!dateStr && slotStart(dateStr, slot).getTime() - Date.now() >= MIN_LEAD_MS;
const formatLongDate = (dateStr) =>
  new Date(`${dateStr}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

function FieldError({ error }) {
  if (!error) return null;
  return (
    <p className="mt-1 text-xs text-red-600" role="alert">
      {error.message || 'Champ requis'}
    </p>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <section className="card p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-ink/50">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { items, subtotal, clear } = useCartStore();
  const customer = user?.customerProfile;
  const specialPrices = usePricesStore((st) => st.prices);
  const isWholesale = customer?.customerType === 'PROFESSIONNEL' && customer?.professionalStatus === 'APPROVED';
  // Un compte cree avec Google n'a pas encore de vrai telephone : on le demande ici.
  const needsContactPhone = !!user && (!!user.needsProfileCompletion || String(user.phone || '').startsWith(PENDING_PHONE_PREFIX));

  usePageMeta('Finaliser ma commande');

  const { register, handleSubmit, trigger, watch, setValue, getValues, formState: { errors } } = useForm({
    defaultValues: { paymentPhoneNumber: '' },
  });

  const [step, setStep] = useState(0);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('MTN_MOMO');
  const [cash, setCash] = useState(null); // éligibilité aux espèces (serveur)
  const payCfg = usePaymentConfig();
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleSlot, setScheduleSlot] = useState('');
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [frequency, setFrequency] = useState('WEEKLY');
  const orderPlacedRef = useRef(false);

  const landmarkValue = watch('landmark');

  useEffect(() => {
    if (items.length === 0 && !orderPlacedRef.current) navigate('/panier');
  }, [items, navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // Adresses enregistrees (client connecte) : l'adresse par defaut est pre-selectionnee.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const addrs = user?.role === 'CUSTOMER' ? await addressesApi.list().catch(() => []) : [];
        if (!alive) return;
        setSavedAddresses(addrs);
        const def = addrs.find((a) => a.isDefault) || addrs[0];
        if (def) setSelectedAddressId(def.id);
      } catch (e) {
        if (alive) toast.error('Impossible de charger vos adresses. Rechargez la page.');
      } finally {
        if (alive) setLoadingRefs(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id, user?.role]);

  // Espèces : réservées aux clients avec compte ayant payé plus de 2 commandes par Mobile Money.
  useEffect(() => {
    let alive = true;
    ordersApi.cashEligibility().then((c) => alive && setCash(c)).catch(() => alive && setCash({ eligible: false, hasAccount: !!user }));
    return () => { alive = false; };
  }, [user?.id]);

  useEffect(() => {
    if (paymentMethod === 'CASH' && cash && !cash.eligible) setPaymentMethod('MTN_MOMO');
  }, [cash, paymentMethod]);

  const subtotalValue = subtotal(customer, specialPrices);
  // Livraison : tarif unique, quelle que soit la distance.
  const deliveryFee = FLAT_DELIVERY_FEE;
  const discount = coupon?.discount || 0;
  const total = Math.max(0, subtotalValue + deliveryFee - discount);
  const selectedAddress = savedAddresses.find((a) => a.id === selectedAddressId);
  const slot = DELIVERY_SLOTS.find((s) => s.value === scheduleSlot);
  const isMomo = paymentMethod === 'MTN_MOMO' || paymentMethod === 'ORANGE_MONEY';
  const cashAllowed = !!cash?.eligible;
  const methodCfg = isMomo ? payCfg?.methods?.[paymentMethod] : null;
  // Production sans clés API : le paiement est impossible -> message d'erreur de développement, commande bloquée.
  const paymentBlocked = !!methodCfg && !methodCfg.configured && payCfg?.environment === 'production';
  const paymentSimulated = !!methodCfg && methodCfg.simulated && payCfg?.environment === 'development';

  const chooseSavedAddress = (a) => {
    setSelectedAddressId(a.id);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocating(false);
        toast.success('Position GPS enregistrée');
      },
      () => {
        setLocating(false);
        toast.error('Position indisponible. Autorisez la localisation ou placez le repère sur la carte.');
      },
      { timeout: 8000 }
    );
  };

  const applyCoupon = async () => {
    setCouponError('');
    if (!couponCode.trim()) return;
    try {
      const result = await couponsApi.validate(couponCode.trim(), subtotalValue);
      setCoupon(result);
      toast.success(`Code ${result.code} appliqué`);
    } catch (err) {
      setCoupon(null);
      setCouponError(err.message);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const startScheduling = (later) => {
    setScheduleLater(later);
    if (later && !scheduleDate) setScheduleDate(toDateInput(addDays(new Date(), 1)));
  };

  const chooseDate = (value) => {
    setScheduleDate(value);
    const current = DELIVERY_SLOTS.find((s) => s.value === scheduleSlot);
    if (current && !slotAvailable(value, current)) setScheduleSlot('');
  };

  // Etape 1 -> 2 : valide l'adresse, la zone et le creneau.
  const goToPayment = async () => {
    setFormError('');
    const fields = [];
    if (!user) fields.push('guestName', 'guestPhone');
    if (!selectedAddressId) {
      fields.push('district', 'landmark');
      if (needsContactPhone) fields.push('contactPhone');
    }
    const valid = fields.length ? await trigger(fields, { shouldFocus: true }) : true;
    if (!valid) return;

    if (scheduleLater) {
      if (!scheduleDate) return setFormError('Choisissez la date de livraison souhaitée.');
      if (!slot) return setFormError('Choisissez un créneau de livraison.');
      if (!slotAvailable(scheduleDate, slot)) return setFormError("Ce créneau n'est plus disponible, choisissez-en un autre.");
    }

    // Pre-remplit le numero Mobile Money avec le telephone deja renseigne.
    if (!getValues('paymentPhoneNumber')) {
      const known = user ? (needsContactPhone ? getValues('contactPhone') : user.phone) : getValues('guestPhone');
      if (known && isMobileMoneyPhone(known)) setValue('paymentPhoneNumber', normalizeMsisdn(known));
    }
    setStep(1);
  };

  // Si une erreur de validation concerne l'etape 1 (champs masques), on y revient.
  const onInvalid = (invalidFields) => {
    if (Object.keys(invalidFields || {}).some((k) => k !== 'paymentPhoneNumber')) setStep(0);
    toast.error('Veuillez corriger les champs signalés.');
  };

  const placeOrder = async (data) => {
    if (orderPlacedRef.current || submitting) return;
    setFormError('');
    if (paymentMethod === 'CASH' && !cashAllowed) {
      setPaymentMethod('MTN_MOMO');
      return setFormError("Le paiement en espèces n'est pas disponible pour cette commande.");
    }
    if (paymentBlocked) return setFormError(`Erreur de développement : le paiement ${methodCfg.label} n'est pas configuré (clés manquantes : ${methodCfg.missing.join(', ')}).`);

    setSubmitting(true);
    try {
      const momoPhone = isMomo ? toInternationalPhone(normalizeMsisdn(data.paymentPhoneNumber)) : undefined;
      const scheduledAt = scheduleLater && slot ? slotStart(scheduleDate, slot) : null;

      const payload = {
        items: orderLines(items),
        paymentMethod,
        paymentPhoneNumber: momoPhone,
        couponCode: coupon ? coupon.code : undefined,
        notes: scheduledAt && slot ? `Créneau souhaité : ${slot.label} (${slot.range})` : undefined,
        scheduledAt: scheduledAt ? scheduledAt.toISOString() : undefined,
      };

      let contactPhone;
      if (!user) {
        payload.guestName = data.guestName.trim();
        payload.guestPhone = normalizeMsisdn(data.guestPhone);
        contactPhone = payload.guestPhone;
      } else {
        contactPhone = needsContactPhone ? normalizeMsisdn(data.contactPhone) : user.phone;
      }

      if (selectedAddressId) {
        payload.addressId = selectedAddressId;
      } else {
        payload.newAddress = {
          fullName: user ? `${user.firstName} ${user.lastName}`.trim() : payload.guestName,
          phone: contactPhone,
          district: data.district.trim(),
          landmark: data.landmark.trim(),
          instructions: data.instructions?.trim() || undefined,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          saveAddress: !!(user && (data.saveAddress || makeRecurring)),
        };
      }

      let order = await ordersApi.create(payload);
      orderPlacedRef.current = true;

      // Paiement Mobile Money : on envoie la demande de validation. Un echec ne
      // bloque pas la commande (deja enregistree) : la page de confirmation
      // permet de relancer le paiement.
      let paymentInitFailed = false;
      let paymentUrl = null;
      if (isMomo) {
        try {
          const init = paymentMethod === 'MTN_MOMO'
            ? await paymentsApi.initiateMtn(order.id, momoPhone)
            : await paymentsApi.initiateOrange(order.id, momoPhone);
          paymentUrl = init?.paymentUrl || null;
          if (order.payment) order = { ...order, payment: { ...order.payment, status: 'PROCESSING', phoneNumber: momoPhone } };
        } catch (e) {
          paymentInitFailed = true;
          toast.error(
            e.details?.code === 'PAYMENT_NOT_CONFIGURED'
              ? e.message
              : "La demande de paiement n'a pas pu être envoyée. Vous pouvez la relancer depuis la page suivante."
          );
        }
      }

      // Commande récurrente (section 75) : cree un modele en plus de la
      // commande immediate, seulement possible pour un client connecte avec
      // une adresse identifiable (celle qui vient d'etre utilisee ou enregistree).
      if (makeRecurring && user) {
        try {
          const addressIdForRecurring = selectedAddressId || order.addressId;
          await recurringOrdersApi.create({
            label: 'Commande habituelle',
            items: orderLines(items),
            addressId: addressIdForRecurring,
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
        JSON.stringify({ id: order.id, orderNumber: order.orderNumber, phone: order.guestPhone || contactPhone })
      );
      clear();
      // Orange Money : le client valide le paiement sur la page Orange, puis revient sur la confirmation.
      if (paymentUrl) {
        window.location.assign(paymentUrl);
        return;
      }
      navigate(`/commande-confirmee/${order.id}`, { state: { order, paymentInitFailed } });
    } catch (err) {
      setFormError(err.message || 'Impossible de créer la commande');
    } finally {
      setSubmitting(false);
    }
  };

  const addressSummary = selectedAddress
    ? [selectedAddress.landmark || selectedAddress.district, selectedAddress.fullName].filter(Boolean).join(' — ')
    : landmarkValue || '';
  const whenSummary = scheduleLater && slot && scheduleDate ? `${formatLongDate(scheduleDate)} · ${slot.label} (${slot.range})` : 'Dès que possible';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">Finaliser la commande</h1>
        {isWholesale && (
          <span className="badge bg-amber-100 text-amber-800">
            <BadgePercent size={13} /> Tarif pro -{customer.wholesaleDiscountPercent}%
          </span>
        )}
      </div>

      <div className="mt-6">
        <CheckoutStepper current={step} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <form
          noValidate
          className="space-y-6 lg:col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 0) goToPayment();
            else handleSubmit(placeOrder, onInvalid)(e);
          }}
        >
          {/* ───────────── Étape 1 : adresse ───────────── */}
          <div className={step === 0 ? 'space-y-6' : 'hidden'}>
            {!user && (
              <SectionCard
                title="Vos coordonnées"
                subtitle={
                  <>
                    Commandez sans créer de compte, ou{' '}
                    <Link to="/connexion" className="font-medium text-brand-700 hover:underline">connectez-vous</Link>.
                  </>
                }
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="guestName">Nom complet</label>
                    <input
                      id="guestName"
                      className="input"
                      autoComplete="name"
                      aria-invalid={!!errors.guestName}
                      {...register('guestName', { required: 'Nom requis', minLength: { value: 2, message: 'Nom trop court' } })}
                    />
                    <FieldError error={errors.guestName} />
                  </div>
                  <div>
                    <label className="label" htmlFor="guestPhone">Téléphone</label>
                    <input
                      id="guestPhone"
                      className="input"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="6XXXXXXXX"
                      aria-invalid={!!errors.guestPhone}
                      {...register('guestPhone', {
                        required: 'Téléphone requis',
                        validate: (v) => isContactPhone(v) || 'Numéro invalide (9 chiffres, ex : 6XXXXXXXX)',
                      })}
                    />
                    <FieldError error={errors.guestPhone} />
                  </div>
                </div>
              </SectionCard>
            )}

            <SectionCard title="Adresse de livraison">
              {savedAddresses.length > 0 && (
                <div className="space-y-2">
                  {savedAddresses.map((a) => (
                    <label
                      key={a.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 focus-within:ring-2 focus-within:ring-brand-600/30 ${selectedAddressId === a.id ? 'border-brand-600 bg-brand-500/5' : 'border-line'}`}
                    >
                      <input type="radio" name="address" className="mt-1" checked={selectedAddressId === a.id} onChange={() => chooseSavedAddress(a)} />
                      <span className="text-sm">
                        <span className="font-medium text-ink">{a.district}</span> — {a.fullName}, {a.phone}
                        {a.landmark && <span className="block text-ink/50">{a.landmark}</span>}
                      </span>
                    </label>
                  ))}
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 focus-within:ring-2 focus-within:ring-brand-600/30 ${!selectedAddressId ? 'border-brand-600 bg-brand-500/5' : 'border-line'}`}
                  >
                    <input type="radio" name="address" checked={!selectedAddressId} onChange={() => setSelectedAddressId('')} />
                    <span className="text-sm font-medium text-ink">+ Utiliser une nouvelle adresse</span>
                  </label>
                </div>
              )}

              <p className={`flex items-center gap-1.5 rounded-lg bg-brand-500/10 px-3 py-2 text-sm font-medium text-brand-700 ${savedAddresses.length > 0 ? 'mt-4' : ''}`}>
                <Truck size={15} /> Livraison à {formatFCFA(FLAT_DELIVERY_FEE)}, quelle que soit la distance.
              </p>

              {!selectedAddressId && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="label" htmlFor="district">Quartier</label>
                    <input
                      id="district"
                      className="input"
                      placeholder="Ex : Essos, Bastos, Odza…"
                      autoComplete="off"
                      aria-invalid={!!errors.district}
                      {...register('district', {
                        required: 'Indiquez votre quartier',
                        minLength: { value: 2, message: 'Quartier trop court' },
                      })}
                    />
                    <FieldError error={errors.district} />
                  </div>

                  <div>
                    <label className="label" htmlFor="landmark">Adresse précise</label>
                    <input
                      id="landmark"
                      className="input"
                      placeholder="Quartier, rue, point de repère (ex : à côté du marché Essos)"
                      aria-invalid={!!errors.landmark}
                      {...register('landmark', {
                        required: 'Précisez votre adresse pour aider le livreur',
                        minLength: { value: 3, message: 'Adresse trop courte' },
                      })}
                    />
                    <FieldError error={errors.landmark} />
                  </div>

                  {needsContactPhone && (
                    <div>
                      <label className="label" htmlFor="contactPhone">Téléphone pour la livraison</label>
                      <input
                        id="contactPhone"
                        className="input max-w-xs"
                        type="tel"
                        inputMode="tel"
                        placeholder="6XXXXXXXX"
                        aria-invalid={!!errors.contactPhone}
                        {...register('contactPhone', {
                          required: 'Téléphone requis',
                          validate: (v) => isContactPhone(v) || 'Numéro invalide (9 chiffres, ex : 6XXXXXXXX)',
                        })}
                      />
                      <FieldError error={errors.contactPhone} />
                      <p className="mt-1 text-xs text-ink/45">Le livreur vous appellera sur ce numéro.</p>
                    </div>
                  )}

                  <div>
                    <label className="label" htmlFor="instructions">Instructions pour le livreur (facultatif)</label>
                    <input id="instructions" className="input" placeholder="Ex : appelez avant d'arriver" {...register('instructions')} />
                  </div>

                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
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
            </SectionCard>

            <SectionCard title="Quand souhaitez-vous être livré ?">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm focus-within:ring-2 focus-within:ring-brand-600/30 ${!scheduleLater ? 'border-brand-600 bg-brand-500/5' : 'border-line'}`}>
                  <input type="radio" name="when" checked={!scheduleLater} onChange={() => startScheduling(false)} />
                  <span>
                    <span className="block font-medium text-ink">Dès que possible</span>
                    <span className="block text-xs text-ink/50">Préparation puis livraison dans les meilleurs délais</span>
                  </span>
                </label>
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm focus-within:ring-2 focus-within:ring-brand-600/30 ${scheduleLater ? 'border-brand-600 bg-brand-500/5' : 'border-line'}`}>
                  <input type="radio" name="when" checked={scheduleLater} onChange={() => startScheduling(true)} />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium text-ink"><CalendarClock size={15} /> Programmer</span>
                    <span className="block text-xs text-ink/50">Choisissez le jour et le créneau</span>
                  </span>
                </label>
              </div>

              {scheduleLater && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="label" htmlFor="scheduleDate">Date de livraison</label>
                    <input
                      id="scheduleDate"
                      type="date"
                      className="input max-w-xs"
                      value={scheduleDate}
                      min={toDateInput(new Date())}
                      max={toDateInput(addDays(new Date(), MAX_SCHEDULE_DAYS))}
                      onChange={(e) => chooseDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="label">Créneau</span>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {DELIVERY_SLOTS.map((s) => {
                        const available = slotAvailable(scheduleDate, s);
                        const selected = scheduleSlot === s.value;
                        return (
                          <label
                            key={s.value}
                            title={available ? undefined : 'Ce créneau est déjà passé ou trop proche'}
                            className={`rounded-lg border p-3 text-center text-sm transition focus-within:ring-2 focus-within:ring-brand-600/30 ${
                              !available ? 'cursor-not-allowed border-line bg-mist/50 text-ink/30' : selected ? 'cursor-pointer border-brand-600 bg-brand-500/5' : 'cursor-pointer border-line hover:border-ink/25'
                            }`}
                          >
                            <input type="radio" name="slot" className="sr-only" disabled={!available} checked={selected} onChange={() => setScheduleSlot(s.value)} />
                            <span className="block font-medium text-ink">{s.label}</span>
                            <span className="block text-xs text-ink/50">{s.range}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {user && (
                <div className="mt-4 border-t border-line pt-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-ink">
                    <input type="checkbox" checked={makeRecurring} onChange={(e) => setMakeRecurring(e.target.checked)} />
                    <Repeat size={15} /> Faire de cette commande une commande habituelle
                  </label>
                  {makeRecurring && (
                    <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="input mt-2 max-w-xs !py-2 text-sm" aria-label="Fréquence">
                      {FREQUENCY_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  )}
                </div>
              )}
            </SectionCard>

            {step === 0 && formError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{formError}</p>
            )}

            <button type="button" onClick={goToPayment} disabled={loadingRefs} className="btn-primary w-full sm:w-auto">
              Continuer vers le paiement <ArrowRight size={17} />
            </button>
          </div>

          {/* ───────────── Étape 2 : paiement ───────────── */}
          <div className={step === 1 ? 'space-y-6' : 'hidden'}>
            <div className="card flex items-start gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mist text-pine-800">
                <Truck size={18} />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-display font-semibold text-ink">Livraison à {selectedAddress?.district || watch('district') || '—'}</p>
                {addressSummary && <p className="truncate text-ink/60">{addressSummary}</p>}
                <p className="text-ink/60">{whenSummary}</p>
              </div>
              <button type="button" onClick={() => setStep(0)} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
                <Pencil size={13} /> Modifier
              </button>
            </div>

            <SectionCard title="Mode de paiement">
              <div className="space-y-2">
                {PAYMENT_OPTIONS.map(({ value, label, hint }) => {
                  const selected = paymentMethod === value;
                  const isCashOption = value === 'CASH';
                  const disabled = isCashOption && !cashAllowed;
                  let hintText = hint;
                  if (disabled) {
                    hintText = !user
                      ? 'Réservé aux clients avec compte ayant déjà payé plus de 2 commandes par Mobile Money.'
                      : cash && cash.hasAccount
                        ? `Disponible après ${cash.required} commandes payées par Mobile Money (encore ${cash.remaining}).`
                        : 'Réservé aux clients ayant déjà payé plus de 2 commandes par Mobile Money.';
                  }
                  return (
                    <label
                      key={value}
                      className={`flex items-center gap-4 rounded-xl2 border p-4 transition focus-within:ring-2 focus-within:ring-brand-600/30 ${
                        disabled ? 'cursor-not-allowed border-line bg-mist/50 opacity-70' : 'cursor-pointer'
                      } ${selected ? 'border-brand-600 bg-brand-500/5 ring-1 ring-brand-600' : disabled ? '' : 'border-line hover:border-ink/25'}`}
                    >
                      <input type="radio" name="paymentMethod" className="sr-only" checked={selected} disabled={disabled} onChange={() => setPaymentMethod(value)} />
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                        {isCashOption ? (
                          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white"><Banknote size={22} /></span>
                        ) : (
                          <PaymentLogo method={value} className="h-11 w-11" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display font-semibold text-ink">{label}</span>
                        <span className="block text-xs text-ink/55">{hintText}</span>
                        {disabled && !user && (
                          <Link to="/inscription" className="mt-1 inline-block text-xs font-medium text-brand-700 hover:underline">Créer un compte</Link>
                        )}
                      </span>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-brand-600' : 'border-line'}`}>
                        {selected && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
                      </span>
                    </label>
                  );
                })}
              </div>

              {paymentBlocked && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <p>
                    <strong>Erreur de développement :</strong> le paiement {methodCfg.label} n&apos;est pas encore configuré
                    (clés manquantes : {methodCfg.missing.join(', ')}). Ajoutez-les dans les variables d&apos;environnement de l&apos;hébergeur.
                  </p>
                </div>
              )}
              {paymentSimulated && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                  <FlaskConical size={16} className="mt-0.5 shrink-0" />
                  <p>
                    <strong>Mode développement :</strong> les clés {methodCfg.label} sont absentes, le paiement sera simulé (aucun argent réel).
                  </p>
                </div>
              )}

              {isMomo && (
                <div className="mt-4">
                  <label className="label" htmlFor="paymentPhoneNumber">Numéro {paymentMethod === 'MTN_MOMO' ? 'MTN Mobile Money' : 'Orange Money'}</label>
                  <input
                    id="paymentPhoneNumber"
                    className="input max-w-xs"
                    type="tel"
                    inputMode="tel"
                    placeholder="6XXXXXXXX"
                    aria-invalid={!!errors.paymentPhoneNumber}
                    {...register('paymentPhoneNumber', {
                      validate: (v) => isMobileMoneyPhone(v) || 'Numéro Mobile Money invalide (9 chiffres, ex : 6XXXXXXXX)',
                    })}
                  />
                  <FieldError error={errors.paymentPhoneNumber} />
                  <p className="mt-1 text-xs text-ink/45">{paymentMethod === 'ORANGE_MONEY' ? 'Vous serez redirigé vers Orange Money pour finaliser le paiement.' : 'Vous recevrez une demande de confirmation sur ce numéro. Gardez votre téléphone à portée de main.'}</p>
                </div>
              )}

              {paymentMethod === 'CASH' && (
                <p className="mt-4 rounded-lg bg-mist/70 px-3 py-2 text-xs text-ink/60">
                  Préparez le montant exact si possible : le livreur encaisse {formatFCFA(total)} à la réception.
                </p>
              )}
            </SectionCard>

            <div className="flex items-center justify-between rounded-xl2 bg-pine-900 px-5 py-4 text-white">
              <span className="text-sm text-white/70">Total à payer</span>
              <span className="font-display text-2xl font-bold">{formatFCFA(total)}</span>
            </div>

            {step === 1 && formError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{formError}</p>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              <button type="button" onClick={() => setStep(0)} disabled={submitting} className="btn-secondary sm:w-auto">
                <ArrowLeft size={16} /> Retour
              </button>
              <button type="submit" disabled={submitting || paymentBlocked} className="btn-primary flex-1">
                {submitting ? <Loader2 size={17} className="animate-spin" /> : <Wallet size={17} />}
                {submitting ? 'Traitement…' : 'Confirmer la commande'}
              </button>
            </div>
            <p className="flex items-center justify-center gap-1.5 text-xs text-ink/45">
              <Lock size={12} /> En confirmant, vous acceptez que votre commande soit préparée et livrée par Fresh Fish.
            </p>
          </div>
        </form>

        {/* ───────────── Récapitulatif ───────────── */}
        <aside className="h-fit space-y-4 lg:sticky lg:top-20">
          <div className="card p-5">
            <h2 className="font-display text-lg font-semibold">Votre commande</h2>
            <ul className="mt-4 space-y-3">
              {items.map((i) => {
                const line = Math.round(getUnitPriceForQuantity(i, i.quantity, customer, specialPrices) * i.quantity);
                return (
                  <li key={lineKey(i)} className="flex items-center gap-3">
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-mist">
                      {i.image ? (
                        <img src={i.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-pine-700/30"><Fish size={20} strokeWidth={1.3} /></span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block truncate font-medium text-ink">{i.name}{i.variantLabel ? ` · ${i.variantLabel}` : ''}</span>
                      <span className="text-ink/50">{i.variantId ? `× ${i.quantity}` : qtyLabel(i)}</span>
                    </span>
                    <span className="text-sm font-semibold text-ink">{formatFCFA(line)}</span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 border-t border-line pt-4">
              {coupon ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-brand-500/10 px-3 py-2 text-sm text-brand-700">
                  <span className="flex items-center gap-1.5 font-medium"><Tag size={14} /> {coupon.code} : -{formatFCFA(coupon.discount)}</span>
                  <button type="button" onClick={removeCoupon} className="rounded-full p-1 hover:bg-brand-500/15" aria-label="Retirer le code promo">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          applyCoupon();
                        }
                      }}
                      placeholder="Code promo"
                      aria-label="Code promo"
                      className="input flex-1 !py-2 text-sm"
                    />
                    <button type="button" onClick={applyCoupon} className="btn-secondary !px-3 !py-2 text-sm">
                      Appliquer
                    </button>
                  </div>
                  {couponError && <p className="mt-1 text-xs text-red-600" role="alert">{couponError}</p>}
                </>
              )}
            </div>

            <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
              <div className="flex justify-between text-ink/60"><span>Sous-total</span><span>{formatFCFA(subtotalValue)}</span></div>
              <div className="flex justify-between text-ink/60">
                <span>Livraison</span>
                <span>{formatFCFA(deliveryFee)}</span>
              </div>
              {discount > 0 && <div className="flex justify-between text-brand-700"><span>Réduction</span><span>-{formatFCFA(discount)}</span></div>}
              <div className="flex justify-between border-t border-line pt-2 font-display text-base font-bold text-ink">
                <span>Total</span>
                <span>{formatFCFA(total)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
