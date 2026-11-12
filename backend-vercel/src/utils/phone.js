// Comparaison tolerante de numeros de telephone camerounais : "6 59 10 30 00",
// "+237 659 103 000" et "659103000" designent le meme numero. Utilise par le
// suivi public d'une commande (client invite), la connexion et la recherche
// de compte : le numero retape plus tard peut avoir un autre format que celui
// saisi a l'inscription.
const PENDING_PHONE_PREFIX = 'google-pending-';

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('237') && digits.length === 12) digits = digits.slice(3);
  return digits;
}

// Un compte Google sans telephone renseigne porte un numero provisoire : il ne
// peut pas servir de preuve d'identite pour le suivi public.
function isPendingPhone(value) {
  return String(value || '').startsWith(PENDING_PHONE_PREFIX);
}

function samePhone(a, b) {
  if (isPendingPhone(a) || isPendingPhone(b)) return false;
  const x = normalizePhone(a);
  const y = normalizePhone(b);
  return x.length > 0 && x === y;
}

// Formes sous lesquelles un meme numero peut etre enregistre en base. La saisie
// brute est toujours la premiere (comportement historique : correspondance exacte).
function phoneCandidates(input) {
  const raw = String(input || '').trim();
  if (!raw) return [];
  const forms = new Set([raw]);
  const local = normalizePhone(raw);
  if (/^[236]\d{8}$/.test(local)) {
    forms.add(local);
    forms.add(`237${local}`);
    forms.add(`+237${local}`);
  }
  return [...forms];
}

// Forme enregistree en base : numero camerounais a 9 chiffres, sans indicatif ni
// espaces. Toute autre valeur (numero etranger, marqueur Google...) est conservee
// telle quelle.
function normalizePhoneForStorage(input) {
  const raw = String(input || '').trim();
  if (isPendingPhone(raw)) return raw;
  const local = normalizePhone(raw);
  return /^[236]\d{8}$/.test(local) ? local : raw;
}

module.exports = { normalizePhone, samePhone, isPendingPhone, phoneCandidates, normalizePhoneForStorage, PENDING_PHONE_PREFIX };
