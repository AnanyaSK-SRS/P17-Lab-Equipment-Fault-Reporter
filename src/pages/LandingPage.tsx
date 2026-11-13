import { useState } from 'react';
import { ArrowRight, CheckCircle2, Cpu, GitFork, ShieldCheck, Wrench } from 'lucide-react';
import heroLabImg from '../assets/images/hero_engineering_lab_1794565030010.jpg';
import { TopBar } from '../components/TopBar';

interface LandingPageProps {
  isAuthenticated: boolean;
  onNavigate: (view: string, anchor?: string) => void;
}

const TEAM_MATRIX = [
  {
    dept: 'ECE',
    team: 'Electronics Lab',
    zone: 'Block-A Electronics Wing',
    scope: 'Oscilloscopes, DC power supplies, FPGA trainers, PCB soldering benches.',
  },
  {
    dept: 'MECH',
    team: 'Mechanical Lab',
    zone: 'Block-B Mechanical Workshop',
    scope: 'CNC lathes, hydraulic test rigs, universal testing machines, metrology benches.',
  },
  {
    dept: 'CSE',
    team: 'IT Lab',
    zone: 'Block-C Computing Center',
    scope: 'Linux/Windows workstations, rack servers, network switches, compiler nodes.',
  },
  {
    dept: 'CENTRAL',
    team: 'Central Stores',
    zone: 'Central Instrumentation & Stores',
    scope: 'Shared calibration spares, consumables depot, and unknown-zone fallback queue.',
  },
];

const WORKFLOW_STEPS = [
  {
    num: '01.',
    title: 'DFA & Regex Identifier Validation',
    body: 'Every submission validates Equipment IDs (LAB[DEPT][3-digit]-ITEM[3-digit]) and Fault Codes (FLT[2-digit]) through both an explicit Python DFA state machine and an equivalent regular expression, rejecting malformed or unsupported department identifiers before dispatch.',
  },
  {
    num: '02.',
    title: 'Deterministic Five-Category Classification',
    body: 'Fault codes and description patterns classify incidents into Safety, Hardware, Calibration, Software, or Consumable. Multi-pattern conflicts resolve deterministically using Safety > Hardware > Calibration > Software > Consumable priority.',
  },
  {
    num: '03.',
    title: 'Capacity-Aware Routing & Safety Alerts',
    body: 'Validated reports route through the department dispatch table to available technicians with remaining capacity, fall back to designated backup handlers when needed, and immediately alert the Lab Safety Officer on any Safety classification.',
  },
  {
    num: '04.',
    title: 'Full Lifecycle Tracking & Analytics',
    body: 'Handlers accept assignments, record resolution notes, and release capacity upon completion—automatically draining queued reports in priority order while feeding real-time SQLite analytics.',
  },
];

export function LandingPage({ isAuthenticated, onNavigate }: LandingPageProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <TopBar onNavigate={onNavigate} isAuthenticated={isAuthenticated} />

      {/* Hero Section */}
      <section id="home" className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div className="text-xs font-medium tracking-wide text-blue-800">
                College Engineering Laboratory Operations · Department Maintenance Portal
              </div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance] leading-[1.12]">
                Structured laboratory fault reporting with verified dispatch.
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                Report malfunctioning lab instruments during practical sessions. Every report is verified
                with DFA and Regex validation, automatically classified, routed to the responsible team,
                and tracked in SQLite through final resolution.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('submit')}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Report a Fault
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate(isAuthenticated ? 'dashboard' : 'auth')}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {isAuthenticated ? 'Open Role Dashboard' : 'Sign In / Register'}
                </button>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
                <span>Format: <code className="font-mono text-slate-800">LABECE123-ITEM456</code></span>
                <span aria-hidden="true">·</span>
                <span>Fault Code: <code className="font-mono text-slate-800">FLT12</code></span>
                <span aria-hidden="true">·</span>
                <span>4 Department Maintenance Teams</span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[280px] overflow-hidden rounded-xl border border-slate-200 bg-[#0B1D3A]">
                {!imgFailed ? (
                  <img
                    src={heroLabImg}
                    alt="University engineering laboratory bench with digital oscilloscopes, signal generators, and student workstations"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center p-10 text-center text-slate-200">
                    <Cpu className="h-12 w-12 text-blue-400 mb-3" />
                    <p className="font-display text-lg font-semibold">Campus Engineering Laboratory</p>
                    <p className="text-sm text-slate-400 mt-1">Electronics, Mechanical, and Computing Instrumentation</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4-column system facts strip below hero split */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 overflow-hidden rounded-xl border border-slate-200">
            <div className="bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Validation Engine</div>
              <div className="mt-1 font-display text-lg font-bold text-slate-900">DFA + Regex Parity</div>
              <div className="mt-1 text-xs text-slate-600">State-transition & pattern agreement</div>
            </div>
            <div className="bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Classification</div>
              <div className="mt-1 font-display text-lg font-bold text-slate-900">5 Fault Categories</div>
              <div className="mt-1 text-xs text-slate-600">Safety, Hardware, Calibration, Software, Consumable</div>
            </div>
            <div className="bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Dispatch Algorithm</div>
              <div className="mt-1 font-display text-lg font-bold text-slate-900">Priority & Capacity</div>
              <div className="mt-1 text-xs text-slate-600">Backup failover & deterministic queueing</div>
            </div>
            <div className="bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Persistence & Tests</div>
              <div className="mt-1 font-display text-lg font-bold text-slate-900">SQLite + 20 Tests</div>
              <div className="mt-1 text-xs text-slate-600">Full audit trail & status history</div>
            </div>
          </div>
        </div>
      </section>

      {/* About the System & Maintenance Directory */}
      <section id="about" className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="max-w-2xl space-y-3">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              About the System
            </h2>
            <p className="text-base text-slate-600 leading-relaxed">
              During college practical sessions, broken oscilloscopes, uncalibrated gauges, software
              driver crashes, or electrical hazards disrupt laboratory schedules. This portal replaces
              informal paper logs with deterministic validation, automated routing, and accountable
              maintenance workflows across all four campus engineering teams.
            </p>
          </div>

          <div className="mt-10 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">Department Code</th>
                  <th className="px-5 py-3.5">Responsible Team</th>
                  <th className="px-5 py-3.5">Primary Campus Zone</th>
                  <th className="px-5 py-3.5">Equipment Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {TEAM_MATRIX.map((row) => (
                  <tr key={row.dept} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-semibold text-blue-800">{row.dept}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{row.team}</td>
                    <td className="px-5 py-3.5 text-slate-600">{row.zone}</td>
                    <td className="px-5 py-3.5 text-slate-600">{row.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div className="max-w-2xl space-y-2">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                How It Works
              </h2>
              <p className="text-base text-slate-600">
                A four-stage Python Flask and SQLite pipeline ensures every fault report is valid,
                correctly categorized, and dispatched without manual bottlenecks.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('validation-lab')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
            >
              Try Interactive DFA & Regex Lab
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {WORKFLOW_STEPS.map((step) => (
              <div
                key={step.num}
                className="rounded-xl border border-slate-200 bg-white p-6 space-y-2.5"
              >
                <div className="font-display text-sm font-bold text-blue-700">{step.num}</div>
                <h3 className="font-display text-lg font-bold text-slate-900">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Role Portals & Evaluation Quick Access */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="rounded-xl border border-slate-200 bg-[#0B1D3A] p-8 sm:p-10 text-white grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-3">
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Role-Based Dashboards & Live System Verification
              </h2>
              <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
                Sign in with the Student/Faculty, Maintenance Handler, or Administrator portal to
                submit reports, process work orders, manage technician capacity, inspect Chart.js
                analytics, or execute the 20-case Python integration test suite.
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-blue-400" />
                  Immediate Safety Officer Alerts
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <GitFork className="h-4 w-4 text-blue-400" />
                  Priority Queue & Failover
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Wrench className="h-4 w-4 text-blue-400" />
                  Capacity-Aware Assignments
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-400" />
                  20 Verified Unit & Integration Tests
                </span>
              </div>
            </div>
            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3">
              <button
                type="button"
                onClick={() => onNavigate('auth')}
                className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors cursor-pointer text-center"
              >
                Sign In with Demo Credentials
              </button>
              <button
                type="button"
                onClick={() => onNavigate('tests')}
                className="rounded-lg border border-slate-600 bg-slate-900/50 px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer text-center"
              >
                Run 20-Case Test Suite
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>Lab Equipment Fault Reporter · College Laboratory Maintenance System</div>
          <div className="flex items-center gap-6">
            <button type="button" onClick={() => onNavigate('submit')} className="hover:text-slate-800 cursor-pointer">
              Report Fault
            </button>
            <button type="button" onClick={() => onNavigate('validation-lab')} className="hover:text-slate-800 cursor-pointer">
              DFA Validator
            </button>
            <button type="button" onClick={() => onNavigate('analytics')} className="hover:text-slate-800 cursor-pointer">
              Analytics
            </button>
            <button type="button" onClick={() => onNavigate('tests')} className="hover:text-slate-800 cursor-pointer">
              Test Suite
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
