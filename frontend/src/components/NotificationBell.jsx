import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { notificationsApi } from '../api/extras';
import { formatRelative } from '../utils/format';
import { toast } from '../store/toastStore';

// La liste se met à jour toute seule : une nouvelle commande apparaît sans recharger la page.
const POLL_MS = 45000;

const TONES = {
  // Fond clair (barre du site, en-tête de l'administration).
  light: { button: 'text-ink/70 hover:bg-mist hover:text-ink', ring: 'ring-white' },
  // Fond sombre (en-tête de l'espace livreur).
  dark: { button: 'text-white/80 hover:bg-white/10 hover:text-white', ring: 'ring-pine-950' },
};

// Seuls les liens internes (« /admin/commandes/123 ») sont suivis, jamais une adresse externe.
const internalLink = (link) => (typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') ? link : null);

/**
 * Cloche de notifications : pastille du nombre de non lues, liste déroulante, « tout marquer comme lu ».
 *  - tone     : 'light' | 'dark' selon le fond de la barre où elle se trouve ;
 *  - align    : côté d'ancrage de la liste sur grand écran ('right' | 'left') ; sur mobile elle prend la largeur de l'écran ;
 *  - toastNew : affiche une bulle quand une nouvelle notification arrive (à couper si l'écran prévient déjà autrement).
 */
export default function NotificationBell({ tone = 'light', align = 'right', toastNew = true }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const rootRef = useRef(null);
  const knownIds = useRef(null); // null tant que la première liste n'est pas arrivée : pas de bulle pour l'existant
  const alive = useRef(true);
  const style = TONES[tone] || TONES.light;

  const load = useCallback(async () => {
    try {
      const data = await notificationsApi.list({ limit: 20 });
      if (!alive.current) return;
      const list = Array.isArray(data) ? data : data?.items || [];
      const count = typeof data?.unreadCount === 'number' ? data.unreadCount : list.filter((n) => !n.isRead).length;
      if (knownIds.current && toastNew) {
        list
          .filter((n) => !n.isRead && !knownIds.current.has(n.id))
          .slice(0, 2)
          .forEach((n) => toast.info(n.title));
      }
      knownIds.current = new Set(list.map((n) => n.id));
      setItems(list);
      setUnread(count);
      setStatus('ready');
    } catch {
      // La cloche ne doit jamais gêner la page : on garde ce qui est affiché et on réessaiera.
      if (alive.current) setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, [toastNew]);

  useEffect(() => {
    alive.current = true;
    load();
    const refresh = () => {
      if (document.visibilityState === 'visible') load();
    };
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      alive.current = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  const openItem = (n) => {
    setOpen(false);
    if (!n.isRead) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnread((c) => Math.max(0, c - 1));
      notificationsApi.markRead(n.id).catch(() => load()); // échec : on se resynchronise avec le serveur
    }
    const to = internalLink(n.link);
    if (to) navigate(to);
  };

  const readAll = async () => {
    setItems((list) => list.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
    try {
      await notificationsApi.markAllRead();
    } catch {
      load();
    }
  };

  const label = unread > 0 ? `Notifications (${unread} non lue${unread > 1 ? 's' : ''})` : 'Notifications';
  const side = align === 'left' ? 'sm:left-0 sm:right-auto' : 'sm:right-0 sm:left-auto';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full transition ${style.button}`}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span
            data-testid="bell-count"
            className={`absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ${style.ring}`}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Notifications"
          className={`fixed inset-x-3 top-16 z-50 overflow-hidden rounded-xl2 border border-line bg-white text-ink shadow-xl sm:absolute sm:inset-x-auto sm:top-full sm:mt-2 sm:w-96 ${side}`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="font-display text-sm font-semibold text-ink">Notifications</h2>
            {unread > 0 && (
              <button type="button" onClick={readAll} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                <CheckCheck size={14} /> Tout marquer comme lu
              </button>
            )}
          </div>

          <ul className="max-h-[min(70vh,420px)] divide-y divide-line overflow-y-auto">
            {status === 'loading' && (
              <li className="space-y-2 px-4 py-4" aria-busy="true">
                <div className="skeleton h-3 w-2/3 rounded" />
                <div className="skeleton h-3 w-full rounded" />
              </li>
            )}
            {status === 'error' && <li className="px-4 py-8 text-center text-sm text-ink/55">Impossible de charger les notifications pour le moment.</li>}
            {status === 'ready' && items.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink/55">Aucune notification pour le moment.</li>}
            {status === 'ready' &&
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    data-unread={n.isRead ? 'false' : 'true'}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-mist/70 ${n.isRead ? '' : 'bg-brand-500/5'}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-brand-600'}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${n.isRead ? 'font-medium text-ink/80' : 'font-semibold text-ink'}`}>
                        {!n.isRead && <span className="sr-only">Non lue : </span>}
                        {n.title}
                      </span>
                      {n.message && <span className="mt-0.5 block break-words text-xs text-ink/60">{n.message}</span>}
                      <span className="mt-1 block text-[11px] text-ink/45">{formatRelative(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
