const ApiError = require('./ApiError');
const { normalizePhone } = require('./phone');
const { DAY_MS, parseDoualaDay } = require('./time');

// Recherche libre dans une liste de commandes (liste admin, paiements, livraisons) : renvoie un
// fragment de filtre Prisma pour le modele Order, ou null si la recherche est vide.
//  - un numero de telephone (meme ecrit « 6 99 12 34 56 » ou « +237 699... ») ou un numero de
//    commande : comparaison directe ;
//  - sinon chaque mot doit se retrouver quelque part (numero, nom du client ou du destinataire,
//    quartier, telephone) : « jean dupont » trouve le client Jean Dupont.
const PHONE_LIKE = /^[+\d][\d\s().+-]*$/;

function orderSearchWhere(search) {
  const text = typeof search === 'string' ? search.trim().slice(0, 80) : '';
  if (!text) return null;

  const digits = normalizePhone(text);
  if (PHONE_LIKE.test(text) && digits.length >= 6) {
    return {
      OR: [
        { orderNumber: { contains: text, mode: 'insensitive' } },
        { guestPhone: { contains: digits } },
        { address: { phone: { contains: digits } } },
        { customer: { user: { phone: { contains: digits } } } },
      ],
    };
  }

  const terms = text.split(/\s+/).slice(0, 5);
  return {
    AND: terms.map((term) => {
      const any = [
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { guestName: { contains: term, mode: 'insensitive' } },
        { address: { fullName: { contains: term, mode: 'insensitive' } } },
        { address: { district: { contains: term, mode: 'insensitive' } } },
        { customer: { user: { firstName: { contains: term, mode: 'insensitive' } } } },
        { customer: { user: { lastName: { contains: term, mode: 'insensitive' } } } },
      ];
      if (/^\d{3,}$/.test(term)) {
        any.push(
          { guestPhone: { contains: term } },
          { address: { phone: { contains: term } } },
          { customer: { user: { phone: { contains: term } } } }
        );
      }
      return { OR: any };
    }),
  };
}

// « 2026-11-07 » (jour de Douala) ou date-heure ISO -> Date ; null si invalide. Une date « AAAA-MM-JJ »
// inexistante (31 fevrier) est refusee, pas « corrigee » en mars.
function parseDateParam(value) {
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return parseDoualaDay(text);
  return Number.isNaN(Date.parse(text)) ? null : new Date(text);
}

// Filtre createdAt a partir de ?from=&to=. Une date de fin « AAAA-MM-JJ » inclut toute la journee
// (jusqu'au lendemain 00:00 exclu) : « du 1er au 7 » contient les commandes du 7 au soir.
function createdAtRange(from, to) {
  const range = {};
  if (from) {
    const start = parseDateParam(from);
    if (!start) throw new ApiError(400, 'Date de debut invalide');
    range.gte = start;
  }
  if (to) {
    const day = parseDoualaDay(String(to).trim());
    const end = day ? new Date(day.getTime() + DAY_MS) : parseDateParam(to);
    if (!end) throw new ApiError(400, 'Date de fin invalide');
    range[day ? 'lt' : 'lte'] = end;
  }
  return Object.keys(range).length ? range : null;
}

// ?status=A,B -> valeur de filtre Prisma (liste validee) ; undefined si absent.
function enumFilter(value, allowed, message) {
  if (!value) return undefined;
  const list = String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (!list.length) return undefined;
  if (list.some((v) => !allowed.includes(v))) throw new ApiError(400, message);
  return list.length === 1 ? list[0] : { in: list };
}

// Pagination ?page=&limit= (limit plafonnee a 100 ; valeur absente ou invalide : defaut).
function pagination(query, defaultLimit = 20) {
  const limit = parseInt(query.limit, 10);
  const pageNumber = parseInt(query.page, 10);
  const take = limit >= 1 ? Math.min(limit, 100) : defaultLimit;
  const page = pageNumber >= 1 ? pageNumber : 1;
  return { take, page, skip: (page - 1) * take };
}

module.exports = { orderSearchWhere, createdAtRange, enumFilter, pagination };
