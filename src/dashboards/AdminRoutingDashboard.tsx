import { useCallback, useEffect, useState } from 'react';
import { Loader2, Play, RefreshCw, UserCheck } from 'lucide-react';
import { CategoryText, PriorityIndicator, StatusIndicator } from '../components/StatusBadge';
import { api } from '../services/api';
import type { AssignmentItem, FaultReport, Handler, RoutingRule } from '../types';

interface AdminRoutingDashboardProps {
  onSelectReport: (reportId: string) => void;
  onDataChanged: () => void;
}

export function AdminRoutingDashboard({
  onSelectReport,
  onDataChanged,
}: AdminRoutingDashboardProps) {
  const [routingTable, setRoutingTable] = useState<RoutingRule[]>([]);
  const [handlers, setHandlers] = useState<Handler[]>([]);
  const [queuedReports, setQueuedReports] = useState<FaultReport[]>([]);
  const [escalatedReports, setEscalatedReports] = useState<FaultReport[]>([]);
  const [routingHistory, setRoutingHistory] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [processingQueue, setProcessingQueue] = useState(false);

  // Manual Reassignment State
  const [reassignTargetId, setReassignTargetId] = useState<string | null>(null);
  const [selectedHandlerId, setSelectedHandlerId] = useState<string>('');
  const [reassignNotes, setReassignNotes] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.routingOverview();
      setRoutingTable(res.routing_table);
      setHandlers(res.handlers);
      setQueuedReports(res.queued_reports);
      setEscalatedReports(res.escalated_reports);
      setRoutingHistory(res.routing_history);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load routing overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleRunQueue = async () => {
    setProcessingQueue(true);
    setBanner(null);
    setError(null);
    try {
      const res = await api.processQueue();
      setBanner(
        res.count > 0
          ? `Queue scheduler dispatched ${res.count} queued report(s) to available handlers.`
          : 'No queued reports could be dispatched right now (handlers unavailable or at capacity).'
      );
      await loadOverview();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Queue execution failed.');
    } finally {
      setProcessingQueue(false);
    }
  };

  const handleManualReassign = async () => {
    if (!reassignTargetId || !selectedHandlerId) return;
    setReassigning(true);
    setError(null);
    setBanner(null);
    try {
      const res = await api.reassignReport(
        reassignTargetId,
        Number(selectedHandlerId),
        reassignNotes || 'Manual administrator reassignment.'
      );
      setBanner(`Report ${reassignTargetId} reassigned to ${res.assigned_handler.name}.`);
      setReassignTargetId(null);
      setSelectedHandlerId('');
      setReassignNotes('');
      await loadOverview();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reassignment failed.');
    } finally {
      setReassigning(false);
    }
  };

  const eligibleHandlers = handlers.filter(
    (h) => h.is_available === 1 && h.current_workload < h.max_capacity
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Routing & Dispatch Management
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Inspect the department routing matrix, handler loads, priority-override escalations, queued
            reports, and manual reassignments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunQueue}
            disabled={processingQueue}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
          >
            {processingQueue ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Process Priority Queue
          </button>
          <button
            type="button"
            onClick={loadOverview}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {banner && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {banner}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Routing Table + Handler Loads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="font-display text-sm font-bold text-slate-900">
              Explicit Department Routing Table
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-2.5">Dept</th>
                  <th className="px-4 py-2.5">Team</th>
                  <th className="px-4 py-2.5">Primary Zone</th>
                  <th className="px-4 py-2.5">Rule Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {routingTable.map((rule) => (
                  <tr key={rule.id}>
                    <td className="px-4 py-3 font-mono font-bold text-blue-800">{rule.department}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{rule.team_name}</td>
                    <td className="px-4 py-3 text-slate-600">{rule.zone}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {rule.is_fallback ? 'Fallback / Correction' : 'Primary Route'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="font-display text-sm font-bold text-slate-900">
              Current Handler Loads & Availability
            </h2>
          </div>
          <div className="divide-y divide-slate-200">
            {handlers.map((h) => {
              const pct = Math.min(100, Math.round((h.current_workload / h.max_capacity) * 100));
              return (
                <div key={h.id} className="px-5 py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {h.name} <span className="font-mono text-slate-500">({h.handler_code})</span>
                    </div>
                    <div className="text-slate-500">
                      {h.team_name} · Backup: {h.backup_handler_name || 'Central Pool'}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className={h.is_available ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                      {h.is_available ? 'Available' : 'Unavailable'}
                    </span>
                    <div className="w-24">
                      <div className="flex justify-between font-mono text-[11px] text-slate-600 mb-1 tabular-nums">
                        <span>Load</span>
                        <span>
                          {h.current_workload}/{h.max_capacity}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full ${pct >= 100 ? 'bg-red-600' : 'bg-blue-700'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Escalated / Priority Override Reports + Queued Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="font-display text-sm font-bold text-slate-900">
              Escalated & Priority-Override Reports ({escalatedReports.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-200">
            {escalatedReports.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No active escalated or priority-override reports.
              </div>
            ) : (
              escalatedReports.map((rep) => (
                <div key={rep.report_id} className="px-5 py-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectReport(rep.report_id)}
                        className="font-mono font-bold text-blue-800 hover:underline cursor-pointer"
                      >
                        {rep.report_id}
                      </button>
                      <PriorityIndicator level={rep.priority_level} />
                      <CategoryText category={rep.detected_category} />
                    </div>
                    <div className="text-slate-600 truncate">
                      {rep.equipment_id} · Handler: {rep.assigned_handler_name || 'Queued'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReassignTargetId(rep.report_id);
                      setSelectedHandlerId(eligibleHandlers[0]?.id ? String(eligibleHandlers[0].id) : '');
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Reassign
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="font-display text-sm font-bold text-slate-900">
              Pending Priority Queue ({queuedReports.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-200">
            {queuedReports.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Dispatch queue is empty — all validated reports are assigned.
              </div>
            ) : (
              queuedReports.map((rep, idx) => (
                <div key={rep.report_id} className="px-5 py-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-slate-500">#{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => onSelectReport(rep.report_id)}
                        className="font-mono font-bold text-blue-800 hover:underline cursor-pointer"
                      >
                        {rep.report_id}
                      </button>
                      <PriorityIndicator level={rep.priority_level} />
                      <StatusIndicator status={rep.status} />
                    </div>
                    <div className="text-slate-600 truncate">
                      {rep.department} · {rep.routing_decision}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReassignTargetId(rep.report_id);
                      setSelectedHandlerId(eligibleHandlers[0]?.id ? String(eligibleHandlers[0].id) : '');
                    }}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
                  >
                    Manual Assign
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Routing & Assignment History */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold text-slate-900">
            Routing & Dispatch Audit History
          </h2>
          {loading && <span className="text-xs text-slate-500">Refreshing...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-2.5">Report ID</th>
                <th className="px-4 py-2.5">Equipment</th>
                <th className="px-4 py-2.5">Team</th>
                <th className="px-4 py-2.5">Assigned Handler</th>
                <th className="px-4 py-2.5">Routing Decision</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Timestamp</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {routingHistory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono font-semibold text-blue-800">
                    <button
                      type="button"
                      onClick={() => onSelectReport(item.report_id)}
                      className="hover:underline cursor-pointer"
                    >
                      {item.report_id}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-700">{item.equipment_id}</td>
                  <td className="px-4 py-2.5 text-slate-800">{item.team_name}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {item.handler_name || 'Unassigned'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-600">{item.routing_decision}</td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {item.is_backup_assignment ? 'Backup' : 'Primary'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums whitespace-nowrap">
                    {new Date(item.assigned_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {item.active === 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setReassignTargetId(item.report_id);
                          setSelectedHandlerId(
                            eligibleHandlers[0]?.id ? String(eligibleHandlers[0].id) : ''
                          );
                        }}
                        className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        Reassign
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Reassignment Modal */}
      {reassignTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                Manual Report Reassignment
              </h3>
              <p className="text-xs text-slate-600">
                Reassign <span className="font-mono font-semibold">{reassignTargetId}</span> to an
                available handler with remaining capacity.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Maintenance Handler
              </label>
              <select
                value={selectedHandlerId}
                onChange={(e) => setSelectedHandlerId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select eligible handler...</option>
                {eligibleHandlers.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.department} · Load {h.current_workload}/{h.max_capacity})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Authorization Note
              </label>
              <input
                type="text"
                value={reassignNotes}
                onChange={(e) => setReassignNotes(e.target.value)}
                placeholder="Reason for manual reassignment..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReassignTargetId(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reassigning || !selectedHandlerId}
                onClick={handleManualReassign}
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
              >
                {reassigning ? 'Assigning...' : 'Confirm Reassignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
