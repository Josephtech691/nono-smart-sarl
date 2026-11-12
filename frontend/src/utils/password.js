// Mot de passe lisible à transmettre à la main : 8 caractères, sans les signes qui se confondent (i l o 0 1 I L O).
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 54 caractères
const LIMIT = 216; // 54 × 4 : au-delà, on retire l'octet pour que chaque caractère ait la même chance (pas de biais)

export function generatePassword(length = 8) {
  const out = [];
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const byte of bytes) {
      if (byte < LIMIT && out.length < length) out.push(ALPHABET[byte % ALPHABET.length]);
    }
  }
  return out.join('');
}
