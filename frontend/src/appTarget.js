// Application en cours : 'all' (site complet, par défaut), 'client', 'admin' ou 'driver'.
// Définie au démarrage par chaque point d'entrée (src/entries/*.jsx).
let target = 'all';
export const setAppTarget = (value) => { target = value; };
export const getAppTarget = () => target;
// Vrai quand l'application est l'une des trois applications séparées (clients, livreurs, admin).
export const isStandaloneApp = () => target !== 'all';
