import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../services/api';
import type { AssignmentItem, FaultReport, StatusHistoryItem } from '../types';
import { CategoryText, PriorityIndicator, StatusIndicator } from './StatusBadge';

interface ReportDetailModalProps {
  reportId: string | null;
  onClose: () => void;
}

export function ReportDetailModal({ reportId, onClose }: ReportDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<FaultReport | null>(null);
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);

  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getReportDetail(reportId)
      .then((res) => {
        if (cancelled) return;
        setReport(res.report);
        setHistory(res.status_history);
        setAssignments(res.assignments);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load report details');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  if (!reportId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 font-mono">
              {reportId}
            </h2>
            <p className="text-xs text-slate-500">Full Validation, Classification & Assignment Trace</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading && <p className="text-sm text-slate-500">Loading report trace from SQLite...</p>}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {report && !loading && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <StatusIndicator status={report.status} />
                <PriorityIndicator level={report.priority_level} />
                <CategoryText category={report.detected_category} />
                <span className="text-xs text-slate-500 tabular-nums">
                  Submitted {new Date(report.created_at).toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <div>
                  <span className="block text-xs text-slate-500">Equipment ID</span>
                  <span className="font-mono font-semibold text-slate-900">{report.equipment_id}</span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Fault Code</span>
                  <span className="font-mono font-semibold text-slate-900">{report.fault_code}</span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Department & Lab</span>
                  <span className="font-medium text-slate-900">
                    {report.department} · {report.lab_name}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Routing Zone</span>
                  <span className="font-medium text-slate-900">{report.routing_zone}</span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Reporter</span>
                  <span className="font-medium text-slate-900">
                    {report.reporter_name} ({report.reporter_id_code})
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Assigned Team & Handler</span>
                  <span className="font-medium text-slate-900">
                    {report.assigned_team_name || 'Unassigned'} ·{' '}
                    {report.assigned_handler_name || 'In Priority Queue'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Fault Description
                </h3>
                <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800 leading-relaxed">
                  {report.fault_description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-200 p-4 space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    DFA & Regex Validation
                  </h3>
                  <p className="text-sm font-medium text-slate-900">
                    DFA: {report.dfa_valid ? 'Accepted' : 'Rejected'} · Regex:{' '}
                    {report.regex_valid ? 'Accepted' : 'Rejected'}
                  </p>
                  <p className="text-xs text-slate-600">
                    Validator Agreement: {report.validation_agreement ? 'Verified (100% Match)' : 'Mismatch'}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 p-4 space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Classification & Routing Decision
                  </h3>
                  <p className="text-sm font-medium text-slate-900">
                    {report.detected_category} · {report.classification_confidence}
                  </p>
                  <p className="text-xs text-slate-600">
                    Routing: <span className="font-mono">{report.routing_decision}</span>
                    {report.priority_override ? ' (Priority Override Active)' : ''}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Classification Reason
                </h3>
                <p className="text-sm text-slate-700">{report.classification_reason}</p>
              </div>

              {report.resolution_notes && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    Resolution Notes
                  </h3>
                  <p className="text-sm text-emerald-900">{report.resolution_notes}</p>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status History ({history.length})
                </h3>
                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                  {history.map((item) => (
                    <div key={item.id} className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-900">
                          {item.old_status ? `${item.old_status} → ${item.new_status}` : item.new_status}
                        </span>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {item.changed_by_name} · {new Date(item.changed_at).toLocaleString()}
                        </span>
                      </div>
                      {item.notes && <p className="mt-1 text-xs text-slate-600">{item.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {assignments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Assignment History ({assignments.length})
                  </h3>
                  <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                    {assignments.map((a) => (
                      <div key={a.id} className="px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold text-slate-900">
                            {a.handler_name || 'Unassigned'} ({a.team_name})
                          </span>{' '}
                          <span className="text-slate-500">
                            · {a.routing_decision} · {a.is_backup_assignment ? 'Backup' : 'Primary'}
                          </span>
                        </div>
                        <span className="text-slate-500 tabular-nums">
                          {a.active ? 'Active' : 'Closed'} · {new Date(a.assigned_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
