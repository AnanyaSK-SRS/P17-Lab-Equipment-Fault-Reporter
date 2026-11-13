import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { CategoryText, PriorityIndicator, StatusIndicator } from '../components/StatusBadge';
import { api } from '../services/api';
import type { FaultReport, ReportSummary, User } from '../types';

interface UserDashboardProps {
  user: User | null;
  onSelectReport: (reportId: string) => void;
  onNewReport: () => void;
}

export function UserDashboard({ user, onSelectReport, onNewReport }: UserDashboardProps) {
  const [reports, setReports] = useState<FaultReport[]>([]);
  const [summary, setSummary] = useState<ReportSummary>({
    total: 0,
    pending: 0,
    assigned: 0,
    in_progress: 0,
    resolved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [scope, setScope] = useState<'all' | 'mine'>(user?.role === 'reporter' ? 'mine' : 'all');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listReports({
        search: search.trim(),
        status: statusFilter,
        department: departmentFilter,
        category: categoryFilter,
        scope: user ? scope : 'all',
      });
      setReports(res.reports);
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, departmentFilter, categoryFilter, scope, user]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const summaryCards = [
    { label: 'Total Reports', value: summary.total, accent: 'text-slate-900' },
    { label: 'Pending Reports', value: summary.pending, accent: 'text-amber-700' },
    { label: 'Assigned Reports', value: summary.assigned, accent: 'text-indigo-700' },
    { label: 'In Progress Reports', value: summary.in_progress, accent: 'text-blue-700' },
    { label: 'Resolved Reports', value: summary.resolved, accent: 'text-emerald-700' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {user?.role === 'reporter' ? 'Reporter Dashboard' : 'Campus Fault Reports Overview'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Track validation outcomes, automatic classification, assigned handlers, and resolution progress.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <div className="flex items-center rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setScope('mine')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  scope === 'mine' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                My Reports
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  scope === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                All Reports
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={fetchReports}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* 5 Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">{card.label}</div>
            <div className={`mt-2 font-display text-2xl font-bold tabular-nums ${card.accent}`}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Report ID (e.g. RPT-202611-004), Equipment ID, or Lab..."
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
        >
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Assigned">Assigned</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
        </select>

        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
        >
          <option value="ALL">All Departments</option>
          <option value="ECE">ECE</option>
          <option value="MECH">MECH</option>
          <option value="CSE">CSE</option>
          <option value="CENTRAL">CENTRAL</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
        >
          <option value="All">All Categories</option>
          <option value="Safety">Safety</option>
          <option value="Hardware">Hardware</option>
          <option value="Calibration">Calibration</option>
          <option value="Software">Software</option>
          <option value="Consumable">Consumable</option>
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      {/* Reports Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Report ID</th>
                <th className="px-4 py-3">Equipment & Dept</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Assigned Handler</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                    Loading reports from SQLite...
                  </td>
                </tr>
              )}
              {!loading && reports.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <p className="text-sm font-medium text-slate-700">No fault reports match these filters.</p>
                    <button
                      type="button"
                      onClick={onNewReport}
                      className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
                    >
                      Submit First Fault Report
                    </button>
                  </td>
                </tr>
              )}
              {!loading &&
                reports.map((rep) => (
                  <tr key={rep.report_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-blue-800 whitespace-nowrap">
                      {rep.report_id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-semibold text-slate-900">{rep.equipment_id}</div>
                      <div className="text-xs text-slate-500">
                        {rep.department} · {rep.lab_name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <CategoryText category={rep.detected_category} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityIndicator level={rep.priority_level} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      <div className="font-medium text-slate-900">
                        {rep.assigned_handler_name || 'Queued'}
                      </div>
                      <div className="text-slate-500">{rep.assigned_team_name || 'Pending Team'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusIndicator status={rep.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {new Date(rep.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectReport(rep.report_id)}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
