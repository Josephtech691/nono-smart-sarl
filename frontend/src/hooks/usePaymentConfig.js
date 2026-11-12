import { useEffect, useState } from 'react';
import { paymentsApi } from '../api/orders';

// Configuration des paiements renvoyée par le serveur : { environment, simulationEnabled, methods }.
// Chargée une seule fois puis partagée. `null` tant qu'elle n'est pas connue (ou si le serveur est injoignable).
let cached = null;
let pending = null;

export default function usePaymentConfig() {
  const [config, setConfig] = useState(cached);

  useEffect(() => {
    if (cached) return undefined;
    let alive = true;
    pending = pending || paymentsApi.config().then((c) => (cached = c)).catch(() => { pending = null; return null; });
    pending.then((c) => alive && c && setConfig(c));
    return () => { alive = false; };
  }, []);

  return config;
}
