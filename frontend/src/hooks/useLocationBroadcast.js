import { useEffect } from 'react';
import { driversApi } from '../api/logistics';
import { useDriverStore } from '../store/driverStore';

const SEND_EVERY_MS = 20000;

/**
 * Partage la position GPS du livreur avec le client (carte de suivi de sa commande) tant qu'une
 * livraison est « récupérée » ou « en route ».
 *
 * Monté une seule fois dans DriverLayout : le partage continue quand le livreur change d'écran
 * (liste, appel du client, historique…) au lieu de s'arrêter en quittant la page de la livraison.
 * L'état (`gps` dans le driverStore) alimente la bannière affichée au livreur :
 *   idle · waiting (en attente du signal) · sharing · denied (localisation refusée) · unsupported
 */
export default function useLocationBroadcast(active) {
  const setGps = useDriverStore((s) => s.setGps);

  useEffect(() => {
    if (!active) {
      setGps('idle');
      return undefined;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGps('unsupported');
      return undefined;
    }

    setGps('waiting');
    let last = null;
    let sending = false;

    const send = () => {
      if (!last || sending) return;
      sending = true;
      driversApi
        .updateMyLocation(last.latitude, last.longitude)
        .catch(() => {}) // un trou de réseau ne doit pas gêner le livreur : on réessaie au prochain tour
        .finally(() => {
          sending = false;
        });
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const first = last === null;
        last = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setGps('sharing');
        if (first) send(); // le client voit le livreur dès le premier signal
      },
      (err) => {
        // code 1 = autorisation refusée ; les autres erreurs (signal perdu, délai) sont passagères.
        setGps(err && err.code === 1 ? 'denied' : 'waiting');
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 }
    );
    const timer = setInterval(send, SEND_EVERY_MS);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(timer);
      setGps('idle');
    };
  }, [active, setGps]);
}
