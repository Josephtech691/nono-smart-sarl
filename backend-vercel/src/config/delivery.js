// Frais de livraison : un tarif unique, quelle que soit la distance ou le quartier.
// Modifiable par la variable d'environnement DELIVERY_FEE (FCFA) ; 1000 FCFA par defaut.
// Le frontend affiche la meme valeur (frontend/src/config.js -> FLAT_DELIVERY_FEE) :
// le montant reellement facture est TOUJOURS celui-ci, calcule cote serveur.
const parsed = Math.round(Number(process.env.DELIVERY_FEE));
const FLAT_DELIVERY_FEE = Number.isFinite(parsed) && parsed >= 0 && process.env.DELIVERY_FEE !== undefined && process.env.DELIVERY_FEE !== '' ? parsed : 1000;

module.exports = { FLAT_DELIVERY_FEE };
