import { useState, type FormEvent } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api, setAuthSession } from '../services/api';
import type { User } from '../types';

interface AuthPageProps {
  onSuccess: (user: User) => void;
  onBack: () => void;
}

const DEMO_ACCOUNTS = [
  { label: 'Student (Reporter)', email: 'student@college.edu', pass: 'Student@123' },
  { label: 'Faculty (Reporter)', email: 'faculty@college.edu', pass: 'Faculty@123' },
  { label: 'ECE Handler', email: 'handler.ece@college.edu', pass: 'Handler@123' },
  { label: 'MECH Handler', email: 'handler.mech@college.edu', pass: 'Handler@123' },
  { label: 'CSE Handler', email: 'handler.cse@college.edu', pass: 'Handler@123' },
  { label: 'Administrator', email: 'admin@college.edu', pass: 'Admin@123' },
];

export function AuthPage({ onSuccess, onBack }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('student@college.edu');
  const [password, setPassword] = useState('Student@123');
  const [role, setRole] = useState<'reporter' | 'handler' | 'admin'>('reporter');
  const [department, setDepartment] = useState('ECE');
  const [userCode, setUserCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        const res = await api.login(email, password);
        setAuthSession(res.token, res.user);
        onSuccess(res.user);
      } else {
        const res = await api.register({
          name,
          email,
          password,
          role,
          department,
          user_code: userCode || undefined,
        });
        setAuthSession(res.token, res.user);
        onSuccess(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portal Home
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Left Panel: Form */}
          <div className="lg:col-span-7 p-6 sm:p-8">
            <div className="mb-6">
              <h1 className="font-display text-2xl font-bold text-slate-900">
                {mode === 'login' ? 'Sign in to Lab Fault Portal' : 'Create College Account'}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Role-based access for Students, Faculty, Maintenance Handlers, and Administrators.
              </p>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`rounded-md py-2 text-sm font-semibold transition-colors cursor-pointer ${
                  mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`rounded-md py-2 text-sm font-semibold transition-colors cursor-pointer ${
                  mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Register
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Rohan Deshpande"
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Account Role</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as 'reporter' | 'handler' | 'admin')}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:border-blue-600 focus:outline-none"
                      >
                        <option value="reporter">Student / Faculty (Reporter)</option>
                        <option value="handler">Maintenance Handler</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:border-blue-600 focus:outline-none"
                      >
                        <option value="ECE">ECE (Electronics)</option>
                        <option value="MECH">MECH (Mechanical)</option>
                        <option value="CSE">CSE (Computer Science)</option>
                        <option value="CENTRAL">CENTRAL (Central Stores)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      USN / Staff ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={userCode}
                      onChange={(e) => setUserCode(e.target.value)}
                      placeholder="e.g., 1RN24CS042"
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">College Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@college.edu"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === 'login' ? 'Sign In to Dashboard' : 'Create Account'}
              </button>
            </form>
          </div>

          {/* Right Panel: Demo Credentials */}
          <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-slate-200 bg-[#0B1D3A] p-6 sm:p-8 text-slate-100 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-base font-bold text-white">Demo Accounts</h2>
                <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                  Select any seeded role account below to prefill credentials and evaluate role-specific
                  dashboards immediately.
                </p>
              </div>

              <div className="space-y-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setEmail(acc.email);
                      setPassword(acc.pass);
                      setError(null);
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3.5 py-2.5 text-left hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-white">
                      <span>{acc.label}</span>
                      <span className="font-mono text-blue-300">Fill</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                      {acc.email} · {acc.pass}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-400">
              Passwords are stored in SQLite using PBKDF2-SHA256 salted hashes with HMAC-SHA256 session tokens.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
