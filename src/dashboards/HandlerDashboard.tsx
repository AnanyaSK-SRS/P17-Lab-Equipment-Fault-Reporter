import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Wrench } from 'lucide-react';
import { CategoryText, PriorityIndicator, StatusIndicator } from '../components/StatusBadge';
import { api } from '../services/api';
import type { FaultReport, User } from '../types';

interface HandlerDashboardProps {
  user: User | null;
  onSelectReport: (reportId: string) => void;
  onDataChanged: () => void;
}

export function HandlerDashboard({ user, onSelectReport, onDataChanged }: HandlerDashboardProps) {
  const [reports, setReports] = useState<FaultReport[]>([]);
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const [scope, setScope] = useState<'assigned' | 'all'>(
    user?.role === 'handler' ? 'assigned' : 'all'
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listReports({ scope });
      setReports(res.reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load handler assignments.');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleStatusUpdate = async (reportId: string, newStatus: string, notes = '') => {
    setUpdatingId(reportId);
    setError(null);
    setFeedback(null);
    try {
      const res = await api.updateReportStatus(reportId, newStatus, notes);
      const drainedCount = res.dispatched_from_queue?.length || 0;
      setFeedback(
        `Report ${reportId} updated to ${newStatus}.` +
          (drainedCount > 0 ? ` Freed capacity auto-dispatched ${drainedCount} queued report(s).` : '')
      );
      setResolvingId(null);
      setResolutionNotes('');
      await loadReports();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const visibleReports = reports.filter((r) =>
    tab === 'active' ? r.status !== 'Resolved' : r.status === 'Resolved'
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Maintenance Handler Workbench
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Accept assigned equipment faults, move tickets into progress, and record verified resolution
            notes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTab('active')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                tab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Active Assignments ({reports.filter((r) => r.status !== 'Resolved').length})
            </button>
            <button
              type="button"
              onClick={() => setTab('completed')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                tab === 'completed' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Completed ({reports.filter((r) => r.status === 'Resolved').length})
            </button>
          </div>

          {user?.role === 'handler' && (
            <div className="flex items-center rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setScope('assigned')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  scope === 'assigned' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                My Queue
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  scope === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                All Labs
              </button>
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {feedback}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading assigned work orders...
        </div>
      ) : visibleReports.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No {tab} assignments found in this view.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleReports.map((rep) => (
            <div
              key={rep.report_id}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onSelectReport(rep.report_id)}
                      className="font-mono text-base font-bold text-blue-800 hover:underline cursor-pointer"
                    >
                      {rep.report_id}
                    </button>
                    <StatusIndicator status={rep.status} />
                    <PriorityIndicator level={rep.priority_level} />
                    <CategoryText category={rep.detected_category} />
                  </div>
                  <div className="text-xs text-slate-500">
                    Equipment <code className="font-mono text-slate-800">{rep.equipment_id}</code> ·{' '}
                    {rep.department} · {rep.lab_name} · Reporter: {rep.reporter_name} (
                    {rep.reporter_id_code}) · {new Date(rep.created_at).toLocaleString()}
                  </div>
                </div>

                {rep.status !== 'Resolved' && (
                  <div className="flex flex-wrap items-center gap-2">
                    {rep.status !== 'In Progress' && (
                      <button
                        type="button"
                        disabled={updatingId === rep.report_id}
                        onClick={() =>
                          handleStatusUpdate(
                            rep.report_id,
                            'In Progress',
                            'Accepted assignment and started diagnostic work.'
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 cursor-pointer"
                      >
                        {updatingId === rep.report_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Wrench className="h-3.5 w-3.5" />
                        )}
                        Accept & Start Work
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setResolvingId(rep.report_id);
                        setResolutionNotes(rep.resolution_notes || '');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mark Resolved
                    </button>
                  </div>
                )}
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">{rep.fault_description}</p>

              {rep.resolution_notes && rep.status === 'Resolved' && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900">
                  <span className="font-semibold">Resolution Notes:</span> {rep.resolution_notes}
                </div>
              )}

              {resolvingId === rep.report_id && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Resolution Notes (Required for Audit Trail)
                  </label>
                  <textarea
                    rows={2}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Describe parts replaced, calibration verified, or software fix applied..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setResolvingId(null)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === rep.report_id || !resolutionNotes.trim()}
                      onClick={() => handleStatusUpdate(rep.report_id, 'Resolved', resolutionNotes)}
                      className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
                    >
                      Confirm Resolution
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
