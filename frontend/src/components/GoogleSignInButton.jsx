import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GSI_SRC = 'https://accounts.google.com/gsi/client';

// Le script Google Identity Services n'est charge qu'une seule fois, meme si
// plusieurs boutons sont montes (Login + Register).
let gsiPromise = null;
function loadGsi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiPromise = null;
      reject(new Error('Impossible de charger Google'));
    };
    document.head.appendChild(script);
  });
  return gsiPromise;
}

/**
 * Bouton "Continuer avec Google".
 * - Ne s'affiche que si VITE_GOOGLE_CLIENT_ID est defini (sinon le composant
 *   disparait : pas de bouton casse en production).
 * - Le jeton recu est envoye au backend (POST /auth/google) qui le verifie
 *   aupres de Google : on ne fait jamais confiance au navigateur seul.
 */
// Google refuse la connexion dans une WebView (application Android) : le bouton n'y est pas affiché,
// le client se connecte avec son téléphone / e-mail et son mot de passe.
export default function GoogleSignInButton() {
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) return null;
  return <GoogleSignInButtonInner />;
}

function GoogleSignInButtonInner() {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;

    loadGsi()
      .then(() => {
        if (cancelled || !containerRef.current) return;

        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async (response) => {
            try {
              const user = await loginWithGoogle(response.credential);
              if (user.role === 'ADMIN') navigate('/admin');
              else if (user.role === 'DRIVER') navigate('/livreur');
              else if (user.needsProfileCompletion) {
                toast.info('Bienvenue ! Ajoutez votre numéro de téléphone pour être livré.');
                navigate('/compte/profil');
              } else navigate(location.state?.from?.pathname || '/compte');
            } catch (err) {
              toast.error(err.message || 'Connexion Google impossible');
            }
          },
        });

        const width = Math.min(400, Math.max(200, Math.floor(containerRef.current.offsetWidth || 320)));
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          locale: 'fr',
          width,
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [loginWithGoogle, navigate, location.state]);

  if (!CLIENT_ID || failed) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-ink/40">
        <span className="h-px flex-1 bg-line" />
        ou
        <span className="h-px flex-1 bg-line" />
      </div>
      <div ref={containerRef} className="flex min-h-[44px] w-full justify-center">
        {!ready && <div className="skeleton h-11 w-full max-w-[320px] rounded-full" aria-hidden="true" />}
      </div>
    </div>
  );
}
