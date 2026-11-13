import { useCallback, useEffect, useState } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import type { AnalyticsData } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const CHART_COLORS = ['#1D4ED8', '#0F172A', '#0284C7', '#D97706', '#DC2626', '#16A34A'];

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [department, setDepartment] = useState('ALL');
  const [category, setCategory] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.analytics({
        department,
        category,
        start_date: startDate,
        end_date: endDate,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }, [department, category, startDate, endDate]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const baseBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        grid: { color: 'rgba(15, 23, 42, 0.06)' },
      },
      x: {
        grid: { display: false },
      },
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Laboratory Fault Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Live Chart.js aggregations queried directly from SQLite report records.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAnalytics}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh Charts
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
          >
            <option value="ALL">All Departments</option>
            <option value="ECE">ECE</option>
            <option value="MECH">MECH</option>
            <option value="CSE">CSE</option>
            <option value="CENTRAL">CENTRAL</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
          >
            <option value="All">All Categories</option>
            <option value="Safety">Safety</option>
            <option value="Hardware">Hardware</option>
            <option value="Calibration">Calibration</option>
            <option value="Software">Software</option>
            <option value="Consumable">Consumable</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setStartDate('');
            setEndDate('');
            setDepartment('ALL');
            setCategory('All');
          }}
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          Reset Filters
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      {loading && !data ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Aggregating SQLite analytics...
        </div>
      ) : data ? (
        <>
          {/* KPI Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Filtered Reports</div>
              <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                {data.totals.total}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Resolved Reports</div>
              <div className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums">
                {data.totals.resolved}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Unresolved Reports</div>
              <div className="mt-1 font-display text-2xl font-bold text-amber-700 tabular-nums">
                {data.totals.unresolved}
              </div>
            </div>
          </div>

          {/* 6 Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="font-display text-sm font-bold text-slate-900">
                1. Category-wise Report Distribution
              </h2>
              <div className="h-64">
                <Bar
                  options={baseBarOptions}
                  data={{
                    labels: data.by_category.map((d) => d.label),
                    datasets: [
                      {
                        label: 'Reports',
                        data: data.by_category.map((d) => d.count),
                        backgroundColor: CHART_COLORS,
                        borderRadius: 6,
                      },
                    ],
                  }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="font-display text-sm font-bold text-slate-900">
                2. Department-wise Report Distribution
              </h2>
              <div className="h-64">
                <Bar
                  options={baseBarOptions}
                  data={{
                    labels: data.by_department.map((d) => d.label),
                    datasets: [
                      {
                        label: 'Reports',
                        data: data.by_department.map((d) => d.count),
                        backgroundColor: '#1D4ED8',
                        borderRadius: 6,
                      },
                    ],
                  }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="font-display text-sm font-bold text-slate-900">
                3. Zone-wise Report Distribution
              </h2>
              <div className="h-64">
                <Bar
                  options={{
                    ...baseBarOptions,
                    indexAxis: 'y' as const,
                    scales: {
                      x: { beginAtZero: true, ticks: { precision: 0 } },
                      y: { grid: { display: false } },
                    },
                  }}
                  data={{
                    labels: data.by_zone.map((d) => d.label),
                    datasets: [
                      {
                        label: 'Reports',
                        data: data.by_zone.map((d) => d.count),
                        backgroundColor: '#0B1D3A',
                        borderRadius: 6,
                      },
                    ],
                  }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="font-display text-sm font-bold text-slate-900">
                4. Resolved vs Unresolved Reports
              </h2>
              <div className="h-64 flex items-center justify-center">
                <Doughnut
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                  }}
                  data={{
                    labels: ['Resolved', 'Unresolved'],
                    datasets: [
                      {
                        data: [data.totals.resolved, data.totals.unresolved],
                        backgroundColor: ['#16A34A', '#D97706'],
                        borderWidth: 0,
                      },
                    ],
                  }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="font-display text-sm font-bold text-slate-900">
                5. Priority-wise Distribution
              </h2>
              <div className="h-64">
                <Bar
                  options={baseBarOptions}
                  data={{
                    labels: data.by_priority.map((d) => d.label),
                    datasets: [
                      {
                        label: 'Reports',
                        data: data.by_priority.map((d) => d.count),
                        backgroundColor: ['#DC2626', '#D97706', '#1D4ED8', '#64748B'],
                        borderRadius: 6,
                      },
                    ],
                  }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="font-display text-sm font-bold text-slate-900">
                6. Monthly Report Statistics
              </h2>
              <div className="h-64">
                <Line
                  options={baseBarOptions}
                  data={{
                    labels: data.by_month.map((d) => d.label),
                    datasets: [
                      {
                        label: 'Monthly Reports',
                        data: data.by_month.map((d) => d.count),
                        borderColor: '#1D4ED8',
                        backgroundColor: 'rgba(29, 78, 216, 0.12)',
                        fill: true,
                        tension: 0.25,
                      },
                    ],
                  }}
                />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
