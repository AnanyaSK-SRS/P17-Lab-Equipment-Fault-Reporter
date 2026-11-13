import { useCallback, useEffect, useState } from 'react';
import { Bell, Check, RefreshCw, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';
import type { NotificationItem } from '../types';

interface NotificationsPageProps {
  onSelectReport: (reportId: string) => void;
  onNotificationsChanged: () => void;
}

export function NotificationsPage({
  onSelectReport,
  onNotificationsChanged,
}: NotificationsPageProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listNotifications(false);
      setItems(res.notifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
      onNotificationsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notification read.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            System Alerts & Safety Notifications
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Persistent SQLite audit feed of Lab Safety Officer alerts, emergency priority overrides,
            handler assignments, and status updates.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200">
        {loading && (
          <div className="p-8 text-center text-sm text-slate-500">Loading notifications...</div>
        )}
        {!loading && items.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-500">No notifications logged yet.</div>
        )}
        {!loading &&
          items.map((n) => (
            <div
              key={n.id}
              className={`p-5 flex flex-wrap items-start justify-between gap-4 ${
                n.is_read ? 'bg-white' : 'bg-blue-50/40'
              }`}
            >
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  {n.severity === 'critical' ? (
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                  ) : (
                    <Bell className="h-4 w-4 text-blue-700" />
                  )}
                  <span className="font-display text-sm font-bold text-slate-900">{n.title}</span>
                  <span className="text-xs text-slate-500">
                    · {n.recipient_name} · {n.notification_type}
                  </span>
                </div>
                <p className="text-sm text-slate-700">{n.message}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
                  <span>{new Date(n.created_at).toLocaleString()}</span>
                  {n.report_id && (
                    <button
                      type="button"
                      onClick={() => onSelectReport(n.report_id!)}
                      className="font-mono font-semibold text-blue-700 hover:underline cursor-pointer"
                    >
                      Inspect {n.report_id}
                    </button>
                  )}
                </div>
              </div>

              {n.is_read === 0 ? (
                <button
                  type="button"
                  onClick={() => handleMarkRead(n.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
                >
                  <Check className="h-3.5 w-3.5" />
                  Mark Read
                </button>
              ) : (
                <span className="text-xs text-slate-400">Read</span>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
