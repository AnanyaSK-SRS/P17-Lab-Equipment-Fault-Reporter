import { useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Cpu, Loader2, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';
import type { User, ValidationBundle } from '../types';

interface ReportSubmissionPageProps {
  user: User | null;
  onViewReport: (reportId: string) => void;
  onGoDashboard: () => void;
}

const FAULT_CODE_EXAMPLES = [
  { code: 'FLT02', label: 'Safety: Smoke / Thermal Overheat' },
  { code: 'FLT10', label: 'Hardware: No Power / PSU Failure' },
  { code: 'FLT22', label: 'Calibration: Trigger / Frequency Drift' },
  { code: 'FLT31', label: 'Software: Driver / Interface Error' },
  { code: 'FLT40', label: 'Consumable: Depleted Solder / Flux' },
];

const ZONE_OPTIONS = [
  { dept: 'ECE', label: 'Block-A Electronics Wing', value: 'Block-A Electronics Wing' },
  { dept: 'MECH', label: 'Block-B Mechanical Workshop', value: 'Block-B Mechanical Workshop' },
  { dept: 'CSE', label: 'Block-C Computing Center', value: 'Block-C Computing Center' },
  { dept: 'CENTRAL', label: 'Central Instrumentation & Stores', value: 'Central Instrumentation & Stores' },
  { dept: 'ANY', label: 'UNKNOWN-ANNEX-99 (Test Fallback Queue)', value: 'UNKNOWN-ANNEX-99' },
];

export function ReportSubmissionPage({
  user,
  onViewReport,
  onGoDashboard,
}: ReportSubmissionPageProps) {
  const localNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const [reporterName, setReporterName] = useState(user?.name || '');
  const [reporterIdCode, setReporterIdCode] = useState(user?.user_code || '');
  const [department, setDepartment] = useState(user?.department || 'ECE');
  const [labName, setLabName] = useState('Digital Electronics Lab');
  const [routingZone, setRoutingZone] = useState('Block-A Electronics Wing');
  const [equipmentId, setEquipmentId] = useState('LABECE123-ITEM456');
  const [faultCode, setFaultCode] = useState('FLT10');
  const [faultDescription, setFaultDescription] = useState('');
  const [urgency, setUrgency] = useState('High');
  const [reportedAt, setReportedAt] = useState(localNow);

  const [validating, setValidating] = useState(false);
  const [validationPreview, setValidationPreview] = useState<ValidationBundle | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<Awaited<
    ReturnType<typeof api.submitReport>
  > | null>(null);

  const handleDepartmentChange = (dept: string) => {
    setDepartment(dept);
    const matchedZone = ZONE_OPTIONS.find((z) => z.dept === dept);
    if (matchedZone) {
      setRoutingZone(matchedZone.value);
    }
  };

  const handleRunValidationCheck = async () => {
    setValidating(true);
    setSubmitError(null);
    try {
      const res = await api.validateIdentifiers(equipmentId, faultCode);
      setValidationPreview(res);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Validation check failed.');
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.submitReport({
        reporter_name: reporterName,
        reporter_id_code: reporterIdCode,
        department,
        lab_name: labName,
        routing_zone: routingZone,
        equipment_id: equipmentId,
        fault_code: faultCode,
        fault_description: faultDescription,
        urgency,
        reported_at: reportedAt,
      });
      setSubmissionResult(res);
      setValidationPreview(res.validation);
    } catch (err) {
      const typed = err as Error & { payload?: { validation?: ValidationBundle } };
      setSubmitError(typed.message || 'Report submission rejected.');
      if (typed.payload?.validation) {
        setValidationPreview(typed.payload.validation);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submissionResult) {
    const { report_id, classification, routing, assignment } = submissionResult;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-xl border border-emerald-200 bg-white p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">
                Fault Report Submitted & Dispatched
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Report persisted to SQLite after DFA + Regex validation, automatic classification, and
                priority dispatch routing.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm">
            <div>
              <span className="block text-xs text-slate-500">Unique Report ID</span>
              <span className="font-mono text-base font-bold text-blue-800">{report_id}</span>
            </div>
            <div>
              <span className="block text-xs text-slate-500">Validation Status</span>
              <span className="font-semibold text-emerald-700">
                DFA & Regex Accepted (100% Agreement)
              </span>
            </div>
            <div>
              <span className="block text-xs text-slate-500">Detected Category</span>
              <span className="font-semibold text-slate-900">
                {classification.category} ({classification.confidence})
              </span>
            </div>
            <div>
              <span className="block text-xs text-slate-500">Priority Level</span>
              <span className="font-semibold text-slate-900">
                {routing.priority_level}
                {routing.priority_override ? ' (Priority Override)' : ''}
              </span>
            </div>
            <div>
              <span className="block text-xs text-slate-500">Assigned Team</span>
              <span className="font-semibold text-slate-900">
                {routing.team_name} ({routing.team_code})
              </span>
            </div>
            <div>
              <span className="block text-xs text-slate-500">Handler / Queue Status</span>
              <span className="font-semibold text-slate-900">
                {assignment.assigned_handler_name
                  ? `${assignment.assigned_handler_name} (${assignment.assigned_handler_code})${
                      assignment.is_backup_assignment ? ' · Backup Handler' : ''
                    }`
                  : `Queued in Priority Queue (Position #${assignment.queue_position ?? 1})`}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 text-sm space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Classification & Routing Justification
            </div>
            <p className="text-slate-700">{classification.reason}</p>
            <p className="text-xs text-slate-500 font-mono pt-1">
              Routing Decision: {routing.routing_decision}
            </p>
          </div>

          {routing.safety_notified && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Lab Safety Officer Immediately Notified</div>
                <div className="text-xs text-red-800 mt-0.5">
                  Because this report was classified under Safety, a high-severity alert was dispatched
                  and logged in the Notifications table.
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onViewReport(report_id)}
              className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 cursor-pointer"
            >
              Inspect Full Report Trace
            </button>
            <button
              type="button"
              onClick={() => {
                setSubmissionResult(null);
                setFaultDescription('');
                setValidationPreview(null);
              }}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              Submit Another Report
            </button>
            <button
              type="button"
              onClick={onGoDashboard}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              Go to Reports Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Submit Lab Equipment Fault Report
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Identifiers undergo dual DFA and Regex verification before classification and automatic team
          dispatch.
        </p>
      </div>

      {submitError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Submission Rejected</div>
            <div className="mt-0.5">{submitError}</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reporter Name</label>
            <input
              type="text"
              required
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="e.g., Ananya Sharma"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reporter ID (USN / Faculty ID)
            </label>
            <input
              type="text"
              required
              value={reporterIdCode}
              onChange={(e) => setReporterIdCode(e.target.value)}
              placeholder="e.g., 1RN24EC014"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
            <select
              value={department}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            >
              <option value="ECE">ECE — Electronics Lab</option>
              <option value="MECH">MECH — Mechanical Lab</option>
              <option value="CSE">CSE — IT Lab</option>
              <option value="CENTRAL">CENTRAL — Central Stores</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Laboratory Name</label>
            <input
              type="text"
              required
              value={labName}
              onChange={(e) => setLabName(e.target.value)}
              placeholder="e.g., Digital Electronics Lab"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Routing Zone</label>
            <select
              value={routingZone}
              onChange={(e) => setRoutingZone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            >
              {ZONE_OPTIONS.map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Date & Time</label>
            <input
              type="datetime-local"
              required
              value={reportedAt}
              onChange={(e) => setReportedAt(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Identifier Validation Box */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900">
                Equipment & Fault Code Identifiers (DFA + Regex Validated)
              </h2>
              <p className="text-xs text-slate-600">
                Required formats: <code className="font-mono">LAB[DEPT][3-digit]-ITEM[3-digit]</code> and{' '}
                <code className="font-mono">FLT[2-digit]</code>
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunValidationCheck}
              disabled={validating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
            >
              {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cpu className="h-3.5 w-3.5" />}
              Verify DFA & Regex Now
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Equipment ID</label>
              <input
                type="text"
                required
                value={equipmentId}
                onChange={(e) => {
                  setEquipmentId(e.target.value);
                  setValidationPreview(null);
                }}
                placeholder="LABECE123-ITEM456"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fault Code</label>
              <input
                type="text"
                required
                value={faultCode}
                onChange={(e) => {
                  setFaultCode(e.target.value);
                  setValidationPreview(null);
                }}
                placeholder="FLT12"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {FAULT_CODE_EXAMPLES.map((ex) => (
                  <button
                    key={ex.code}
                    type="button"
                    onClick={() => {
                      setFaultCode(ex.code);
                      setValidationPreview(null);
                    }}
                    title={ex.label}
                    className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-700 hover:border-blue-400 hover:text-blue-700 cursor-pointer"
                  >
                    {ex.code}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {validationPreview && (
            <div
              className={`rounded-lg border p-3.5 text-xs space-y-1 ${
                validationPreview.valid
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-red-200 bg-red-50 text-red-900'
              }`}
            >
              <div className="font-semibold">
                {validationPreview.valid
                  ? 'ACCEPTED: Both DFA and Regex matched.'
                  : 'REJECTED: Identifier format invalid.'}{' '}
                (DFA/Regex Agreement: {validationPreview.agreement ? 'Yes' : 'No'})
              </div>
              {validationPreview.errors.length > 0 && (
                <ul className="list-disc pl-5 space-y-0.5">
                  {validationPreview.errors.map((errMsg, idx) => (
                    <li key={idx}>{errMsg}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fault Description
            </label>
            <textarea
              required
              rows={4}
              value={faultDescription}
              onChange={(e) => setFaultDescription(e.target.value)}
              placeholder="Describe the observed symptom, error message, physical damage, calibration drift, or safety hazard..."
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Urgency Level</label>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Emergency/Critical">Emergency/Critical</option>
            </select>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Emergency/Critical triggers automatic priority override at the top of the dispatch queue.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Validate & Submit Fault Report
          </button>
        </div>
      </form>
    </div>
  );
}
