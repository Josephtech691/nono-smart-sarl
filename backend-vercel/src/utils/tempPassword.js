const crypto = require('crypto');

// Mot de passe provisoire remis par l'administrateur (livreur ou client qui a perdu le sien) :
// 10 caracteres sans ceux qu'on confond a la lecture (0/O, 1/l/I), tires avec crypto.randomInt.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function generateTempPassword(length = 10) {
  let password = '';
  for (let i = 0; i < length; i += 1) password += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  return password;
}

module.exports = { generateTempPassword };
