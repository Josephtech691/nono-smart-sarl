import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { notificationsApi } from '../../api/extras';
import { formatRelative } from '../../utils/format';
import usePageMeta from '../../utils/usePageMeta';
import EmptyState from '../../components/EmptyState';

// Seuls les liens internes sont suivis, jamais une adresse externe.
const internalLink = (link) => (typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') ? link : null);

/** Toutes les notifications du livreur (nouvelle livraison, annulation…), en pleine page. */
export default function DriverNotifications() {
  usePageMeta('Notifications');
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await notificationsApi.list({ limit: 50 });
      setItems(Array.isArray(data) ? data : data?.items || []);
      setFailed(false);
    } catch {
      setFailed(true);
      setItems((prev) => prev || []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unread = (items || []).filter((n) => !n.isRead).length;

  const open = (n) => {
    if (!n.isRead) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      notificationsApi.markRead(n.id).catch(() => load());
    }
    const to = internalLink(n.link);
    if (to) navigate(to);
  };

  const readAll = async () => {
    setItems((list) => list.map((x) => ({ ...x, isRead: true })));
    try {
      await notificationsApi.markAllRead();
    } catch {
      load();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold">Notifications</h1>
        {unread > 0 && (
          <button type="button" onClick={readAll} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
            <CheckCheck size={16} /> Tout marquer comme lu
          </button>
        )}
      </div>

      {items === null ? (
        <div className="mt-4 space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-xl2" />)}
        </div>
      ) : failed && items.length === 0 ? (
        <p role="status" className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Impossible de charger les notifications pour le moment.</p>
      ) : items.length === 0 ? (
        <div className="mt-6"><EmptyState icon={Bell} title="Aucune notification" description="Les nouvelles livraisons et les annulations apparaîtront ici." /></div>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className={`card flex w-full items-start gap-3 p-4 text-left transition active:bg-mist ${n.isRead ? '' : 'border-brand-500/40 bg-brand-500/5'}`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-brand-600'}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${n.isRead ? 'font-medium text-ink/80' : 'font-semibold text-ink'}`}>{n.title}</span>
                  {n.message && <span className="mt-0.5 block break-words text-sm text-ink/60">{n.message}</span>}
                  <span className="mt-1 block text-xs text-ink/45">{formatRelative(n.createdAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
