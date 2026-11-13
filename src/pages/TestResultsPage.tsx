import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Play, XCircle } from 'lucide-react';
import { api } from '../services/api';
import type { TestSuiteResult } from '../types';

export function TestResultsPage() {
  const [result, setResult] = useState<TestSuiteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runSuite = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.runTests();
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute Python test suite.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runSuite();
  }, [runSuite]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Automated Verification & Test Results
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Live execution of the 20-case Python <code className="font-mono">unittest</code> suite
            against isolated SQLite databases.
          </p>
        </div>

        <button
          type="button"
          onClick={runSuite}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Re-Run All 20 Tests
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      {loading && !result && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Executing 20 Python integration tests...
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Total Test Cases</div>
              <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                {result.total}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Passed</div>
              <div className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums">
                {result.passed}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Failed</div>
              <div
                className={`mt-1 font-display text-2xl font-bold tabular-nums ${
                  result.failed === 0 ? 'text-slate-900' : 'text-red-700'
                }`}
              >
                {result.failed}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-slate-900">
                Test Execution Report ({result.all_passed ? 'ALL PASSED' : 'FAILURES DETECTED'})
              </h2>
              <span className="text-xs font-mono text-slate-500">backend/tests/test_suite.py</span>
            </div>
            <div className="divide-y divide-slate-200">
              {result.tests.map((t, index) => (
                <div key={t.name} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-slate-400 w-6 tabular-nums">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {t.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{t.label}</div>
                      <div className="font-mono text-[11px] text-slate-500">{t.name}</div>
                      {t.error && (
                        <pre className="mt-1 text-xs text-red-700 whitespace-pre-wrap">{t.error}</pre>
                      )}
                    </div>
                  </div>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-xs font-semibold shrink-0 ${
                      t.passed
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-red-200 bg-red-50 text-red-800'
                    }`}
                  >
                    {t.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
