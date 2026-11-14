// Couche native de l'application Android « Fresh Fish — clients ».
// Elle s'ajoute au site SANS le modifier : même design, mêmes pages. Elle apporte ce qu'un site ne fait pas :
//  - notifications push (bannière en haut de l'écran, puis volet de notifications du téléphone) ;
//  - rafraîchissement en tirant la page vers le bas ;
//  - bouton « retour » d'Android, écran de démarrage, barre d'état, mode hors connexion.
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

const API_URL = __API_URL__; // injecté à la compilation (scripts/prepare-web.mjs)
const TOKEN_KEY = 'fresh_fish_token'; // même clé que le site (frontend/src/utils/tokenStorage.js)
const CHANNEL_ID = 'orders';
const GREEN = '#0F3D2C';

const safe = (fn) => {
  try {
    const r = fn();
    return r && typeof r.catch === 'function' ? r.catch(() => {}) : r;
  } catch (e) {
    return undefined;
  }
};

document.documentElement.classList.add('is-native');

// ---------------------------------------------------------------------------------------------------------
// Style « application » : pas de sélection de texte hors champs, pas de rebond de page, pas de halo au toucher.
// ---------------------------------------------------------------------------------------------------------
const style = document.createElement('style');
style.textContent = `
  .is-native, .is-native body { overscroll-behavior-y: none; -webkit-tap-highlight-color: transparent; }
  .is-native body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  .is-native input, .is-native textarea, .is-native [contenteditable] { -webkit-user-select: text; user-select: text; }
  #ff-ptr { position: fixed; left: 50%; top: 0; z-index: 99999; width: 40px; height: 40px; margin-left: -20px; border-radius: 50%;
    background: #fff; box-shadow: 0 4px 14px rgba(15,61,44,.28); display: flex; align-items: center; justify-content: center;
    transform: translateY(-60px); opacity: 0; pointer-events: none; will-change: transform; padding-top: env(safe-area-inset-top, 0); }
  #ff-ptr svg { width: 22px; height: 22px; stroke: ${GREEN}; fill: none; stroke-width: 2.6; stroke-linecap: round; }
  #ff-ptr.spin svg { animation: ff-spin .8s linear infinite; }
  @keyframes ff-spin { to { transform: rotate(360deg); } }
  #ff-banner { position: fixed; left: 0; right: 0; top: 0; z-index: 99998; padding: calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px;
    background: #1f2937; color: #fff; font: 500 13px/1.3 Inter, system-ui, sans-serif; text-align: center; transform: translateY(-120%);
    transition: transform .25s ease; }
  #ff-banner.show { transform: translateY(0); }
  #ff-banner.ok { background: ${GREEN}; }
  #ff-banner button { margin-left: 10px; background: rgba(255,255,255,.2); border: 0; color: #fff; padding: 3px 10px; border-radius: 999px; font: inherit; }
  #ff-toast { position: fixed; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 96px); z-index: 99999; transform: translateX(-50%);
    background: rgba(31,41,55,.92); color: #fff; padding: 9px 16px; border-radius: 999px; font: 500 13px Inter, system-ui, sans-serif;
    opacity: 0; transition: opacity .2s; pointer-events: none; }
  #ff-toast.show { opacity: 1; }
`;
document.head.appendChild(style);

// Petit message en bas de l'écran (comme un « toast » Android).
const toastEl = document.createElement('div');
toastEl.id = 'ff-toast';
let toastTimer = null;
function toast(text) {
  if (!toastEl.isConnected) document.body.appendChild(toastEl);
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

// ---------------------------------------------------------------------------------------------------------
// Navigation interne sans recharger l'application (le routeur du site écoute « popstate »).
// ---------------------------------------------------------------------------------------------------------
function goTo(link) {
  // Seuls les chemins internes sont suivis, jamais une adresse externe venue d'une notification.
  if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//')) return;
  const run = () => {
    window.history.pushState({}, '', link);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  // Démarrage à froid : on attend que le site soit affiché.
  const ready = () => document.getElementById('root')?.children.length > 0;
  if (ready()) run();
  else {
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      if (ready() || tries > 40) {
        clearInterval(t);
        run();
      }
    }, 150);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Rafraîchir en glissant le doigt vers le bas, depuis le haut de la page (comme dans un navigateur).
// ---------------------------------------------------------------------------------------------------------
function setupPullToRefresh() {
  const THRESHOLD = 80;
  const MAX = 130;
  const el = document.createElement('div');
  el.id = 'ff-ptr';
  el.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>';
  document.body.appendChild(el);

  let startY = 0;
  let startX = 0;
  let pulling = false;
  let pull = 0;
  let busy = false;

  const atTop = (target) => {
    if (window.scrollY > 0 || document.documentElement.scrollTop > 0) return false;
    for (let n = target; n && n !== document.body; n = n.parentElement) {
      if (n.scrollTop > 0) return false; // une liste interne défile : on ne déclenche pas
    }
    return true;
  };
  const blocked = (target) =>
    !!target.closest?.('.leaflet-container, input, textarea, select, [data-no-ptr]') ||
    document.body.style.overflow === 'hidden'; // fenêtre ouverte (menu, panier...)

  const paint = (y, spin = false) => {
    el.style.transition = pulling ? 'none' : 'transform .2s ease, opacity .2s ease';
    el.style.transform = `translateY(${y - 50}px) rotate(${y * 3}deg)`;
    el.style.opacity = String(Math.min(1, y / 40));
    el.classList.toggle('spin', spin);
  };
  const reset = () => {
    pulling = false;
    pull = 0;
    paint(0);
  };

  document.addEventListener('touchstart', (e) => {
    if (busy || e.touches.length !== 1 || blocked(e.target) || !atTop(e.target)) return;
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    pulling = true;
    pull = 0;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!pulling || busy) return;
    const dy = e.touches[0].clientY - startY;
    const dx = Math.abs(e.touches[0].clientX - startX);
    if (dy <= 0 || dx > dy || window.scrollY > 0) return reset(); // glissement vers le haut / de côté : on laisse faire
    pull = Math.min(MAX, dy * 0.5);
    if (e.cancelable) e.preventDefault();
    paint(pull);
  }, { passive: false });

  const end = () => {
    if (!pulling) return;
    const go = pull >= THRESHOLD * 0.55; // ~90 px de glissement
    pulling = false;
    if (go) {
      busy = true;
      paint(54, true);
      setTimeout(() => window.location.reload(), 350);
    } else {
      reset();
    }
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', reset, { passive: true });
}

// ---------------------------------------------------------------------------------------------------------
// Bouton « retour » d'Android : page précédente ; sur l'accueil, appuyer deux fois pour quitter.
// ---------------------------------------------------------------------------------------------------------
function setupBackButton() {
  let lastBack = 0;
  App.addListener('backButton', () => {
    const idx = window.history.state && window.history.state.idx;
    if (typeof idx === 'number' ? idx > 0 : window.location.pathname !== '/') {
      window.history.back();
      return;
    }
    if (window.location.pathname !== '/') {
      window.history.replaceState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }
    const now = Date.now();
    if (now - lastBack < 2000) App.exitApp();
    else {
      lastBack = now;
      toast('Appuyez encore pour quitter');
    }
  });
}

// ---------------------------------------------------------------------------------------------------------
// Connexion Internet : bandeau en haut quand le téléphone est hors ligne.
// ---------------------------------------------------------------------------------------------------------
function setupNetworkBanner() {
  const banner = document.createElement('div');
  banner.id = 'ff-banner';
  document.body.appendChild(banner);
  let wasOffline = false;
  let hideTimer = null;

  const show = (online) => {
    clearTimeout(hideTimer);
    if (online) {
      if (!wasOffline) return;
      wasOffline = false;
      banner.className = 'show ok';
      banner.textContent = 'Connexion rétablie';
      hideTimer = setTimeout(() => banner.classList.remove('show'), 2200);
    } else {
      wasOffline = true;
      banner.className = 'show';
      banner.innerHTML = 'Pas de connexion Internet <button type="button">Réessayer</button>';
      banner.querySelector('button').onclick = () => window.location.reload();
    }
  };
  Network.addListener('networkStatusChange', (s) => show(s.connected));
  safe(() => Network.getStatus().then((s) => { if (!s.connected) show(false); }));
}

// ---------------------------------------------------------------------------------------------------------
// Notifications push.
//  - Application fermée ou en arrière-plan : le système affiche la notification (bannière puis volet).
//  - Application ouverte : Firebase ne l'affiche pas ; on la montre nous-mêmes en bannière.
//  - Un appui sur la notification ouvre la page concernée (commande, suivi...).
// ---------------------------------------------------------------------------------------------------------
let fcmToken = null;
let syncedKey = '';
let lastAuth = null;

const readAuth = () => {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) || window.localStorage.getItem(TOKEN_KEY);
  } catch (e) {
    return null;
  }
};

async function callDevices(method, auth) {
  await fetch(`${API_URL}/devices`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
    body: JSON.stringify({ token: fcmToken, platform: 'android' }),
  });
}

async function syncDevice() {
  const auth = readAuth();
  // Déconnexion : ce téléphone ne reçoit plus les notifications de ce compte.
  if (!auth && lastAuth && fcmToken) {
    const previous = lastAuth;
    lastAuth = null;
    syncedKey = '';
    safe(() => callDevices('DELETE', previous));
    return;
  }
  if (!auth) return;
  lastAuth = auth;

  // Connexion : on demande l'autorisation d'envoyer des notifications (Android 13+), puis on s'enregistre.
  if (!fcmToken) {
    const perm = await PushNotifications.checkPermissions();
    let state = perm.receive;
    if (state === 'prompt' || state === 'prompt-with-rationale') state = (await PushNotifications.requestPermissions()).receive;
    if (state === 'granted') {
      safe(() => LocalNotifications.requestPermissions());
      await PushNotifications.register(); // déclenche l'événement « registration »
    }
    return;
  }
  const key = `${auth}|${fcmToken}`;
  if (key === syncedKey) return;
  syncedKey = key;
  safe(() => callDevices('POST', auth));
}

async function setupPush() {
  // Canal à importance maximale : bannière en haut de l'écran, son et vibration.
  await safe(() => PushNotifications.createChannel({
    id: CHANNEL_ID, name: 'Commandes et livraisons', description: 'État de vos commandes et de vos livraisons',
    importance: 5, visibility: 1, vibration: true, lights: true, lightColor: GREEN,
  }));

  PushNotifications.addListener('registration', (t) => {
    fcmToken = t.value;
    syncedKey = '';
    syncDevice();
  });
  PushNotifications.addListener('registrationError', () => {});

  // Application ouverte : bannière locale.
  PushNotifications.addListener('pushNotificationReceived', (n) => {
    safe(() => LocalNotifications.schedule({
      notifications: [{
        id: Math.floor(Math.random() * 2147483000),
        title: n.title || 'Fresh Fish',
        body: n.body || '',
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_notify',
        extra: { link: (n.data && n.data.link) || '' },
      }],
    }));
  });

  // Appui sur une notification (système ou locale).
  PushNotifications.addListener('pushNotificationActionPerformed', (a) => goTo(a.notification?.data?.link));
  LocalNotifications.addListener('localNotificationActionPerformed', (a) => goTo(a.notification?.extra?.link));

  // Connexion / déconnexion : on surveille le jeton de session du site.
  setInterval(syncDevice, 2000);
  App.addListener('resume', syncDevice);
  syncDevice();
}

// ---------------------------------------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------------------------------------
function hideSplash() {
  const ready = () => document.getElementById('root')?.children.length > 0;
  let tries = 0;
  const t = setInterval(() => {
    tries += 1;
    if (ready() || tries > 50) {
      clearInterval(t);
      safe(() => SplashScreen.hide({ fadeOutDuration: 250 }));
    }
  }, 100);
}

function start() {
  safe(() => StatusBar.setStyle({ style: Style.Light })); // icônes sombres sur fond clair
  safe(() => StatusBar.setBackgroundColor({ color: '#FFFFFF' }));
  hideSplash();
  setupPullToRefresh();
  setupBackButton();
  setupNetworkBanner();
  safe(setupPush);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
