import { useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { api } from '../services/api';
import type { ClassificationResult, ValidationBundle } from '../types';

const PRESETS = [
  { label: 'Valid ECE ID + FLT12', eq: 'LABECE123-ITEM456', fc: 'FLT12', desc: 'Oscilloscope screen blank and no display backlight.' },
  { label: 'Valid MECH ID + FLT23', eq: 'LABMECH042-ITEM108', fc: 'FLT23', desc: 'Load cell gauge drifts +3% from reference.' },
  { label: 'Unsupported Dept (BIO)', eq: 'LABBIO123-ITEM456', fc: 'FLT10', desc: 'Unsupported department code should be rejected.' },
  { label: 'Incomplete Equipment ID', eq: 'LABECE12-ITEM456', fc: 'FLT10', desc: 'Only 2 lab digits instead of 3.' },
  { label: 'Invalid Fault Code (FLT1)', eq: 'LABCSE101-ITEM202', fc: 'FLT1', desc: 'Incomplete 1-digit fault code.' },
  { label: 'Conflict: Safety + Software', eq: 'LABCSE301-ITEM019', fc: 'FLT31', desc: 'USB driver crash occurred before smoke and sparking near PSU.' },
  { label: 'Unmapped Fault Code (FLT88)', eq: 'LABCENTRAL005-ITEM012', fc: 'FLT88', desc: 'Solder spool and flux syringe depleted on bench.' },
];

export function ValidationLabPage() {
  const [equipmentId, setEquipmentId] = useState('LABECE123-ITEM456');
  const [faultCode, setFaultCode] = useState('FLT12');
  const [description, setDescription] = useState('Oscilloscope screen blank with broken BNC input connector.');
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<ValidationBundle | null>(null);
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async (eq: string, fc: string, desc: string) => {
    setLoading(true);
    setError(null);
    try {
      const [valRes, clsRes] = await Promise.all([
        api.validateIdentifiers(eq, fc),
        api.previewClassification(fc, desc),
      ]);
      setValidation(valRes);
      setClassification(clsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation service error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    runAnalysis(equipmentId, faultCode, description);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          DFA, Regex & Classification Evaluation Lab
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Demonstrate the Python DFA state-transition machine, equivalent regular-expression validator,
          agreement check, and automatic classification engine.
        </p>
      </div>

      {/* Presets */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Evaluation Test Presets
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setEquipmentId(p.eq);
                setFaultCode(p.fc);
                setDescription(p.desc);
                runAnalysis(p.eq, p.fc, p.desc);
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-900 transition-colors cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Equipment ID (<code className="font-mono">LAB[DEPT][3-digit]-ITEM[3-digit]</code>)
            </label>
            <input
              type="text"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fault Code (<code className="font-mono">FLT[2-digit]</code>)
            </label>
            <input
              type="text"
              value={faultCode}
              onChange={(e) => setFaultCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Sample Fault Description (for Classification Pattern Engine)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 cursor-pointer"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Run DFA, Regex & Classifier
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      {validation && (
        <div className="space-y-6">
          {/* Comparison Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">DFA Result</div>
              <div className="mt-2 flex items-center gap-2 font-display text-lg font-bold">
                {validation.dfa_valid ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span className="text-emerald-800">ACCEPTED</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="text-red-800">REJECTED</span>
                  </>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-600 font-mono">
                Final State: {validation.equipment_id.dfa.final_state}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Equivalent Regex Result</div>
              <div className="mt-2 flex items-center gap-2 font-display text-lg font-bold">
                {validation.regex_valid ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span className="text-emerald-800">MATCHED</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="text-red-800">MISMATCH</span>
                  </>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-600 font-mono truncate" title={validation.equipment_id.regex.pattern}>
                {validation.equipment_id.regex.pattern}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">DFA vs Regex Parity</div>
              <div className="mt-2 font-display text-lg font-bold text-slate-900">
                {validation.agreement ? '100% Agreement' : 'Disagreement Detected'}
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Both formalisms produced identical acceptance decisions.
              </div>
            </div>
          </div>

          {validation.errors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 space-y-1">
              <div className="font-semibold">Validation Diagnostics</div>
              {validation.errors.map((e, i) => (
                <div key={i} className="text-xs">
                  {e}
                </div>
              ))}
            </div>
          )}

          {/* Classification Preview */}
          {classification && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-slate-900">
                  Automatic Classification Output: {classification.category}
                </h2>
                <span className="text-xs font-medium text-slate-600">{classification.confidence}</span>
              </div>
              <p className="text-sm text-slate-700">{classification.reason}</p>
            </div>
          )}

          {/* DFA State Transition Trace Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-slate-900">
                Equipment ID DFA Character-by-Character Transition Trace
              </h2>
              <span className="text-xs font-mono text-slate-500">
                q0 → {validation.equipment_id.dfa.final_state}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                  <tr>
                    <th className="px-4 py-2.5">Step</th>
                    <th className="px-4 py-2.5">Symbol</th>
                    <th className="px-4 py-2.5">From State</th>
                    <th className="px-4 py-2.5">To State</th>
                    <th className="px-4 py-2.5">State Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {validation.equipment_id.dfa.transitions.map((t) => (
                    <tr
                      key={t.step}
                      className={t.to_state === 'q_DEAD' ? 'bg-red-50 text-red-900' : 'bg-white'}
                    >
                      <td className="px-4 py-2 tabular-nums">{t.step}</td>
                      <td className="px-4 py-2 font-bold">'{t.char}'</td>
                      <td className="px-4 py-2">{t.from_state}</td>
                      <td className="px-4 py-2 font-semibold">{t.to_state}</td>
                      <td className="px-4 py-2 font-sans">
                        {t.accepted_so_far
                          ? 'Accepting State'
                          : t.to_state === 'q_DEAD'
                            ? 'Dead / Reject State'
                            : 'Intermediate State'}
                      </td>
                    </tr>
                  ))}
                  {validation.equipment_id.dfa.transitions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center font-sans text-slate-500">
                        Empty input — stayed in start state q0 (non-accepting).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
