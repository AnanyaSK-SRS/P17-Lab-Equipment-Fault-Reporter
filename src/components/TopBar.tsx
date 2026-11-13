import { useState } from 'react';
import { Menu, X } from 'lucide-react';

interface TopBarProps {
  onNavigate: (view: string, anchor?: string) => void;
  isAuthenticated: boolean;
}

export function TopBar({ onNavigate, isAuthenticated }: TopBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLink = (view: string, anchor?: string) => {
    setMobileOpen(false);
    onNavigate(view, anchor);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-3.5">
        {/* Zone 1: Single clean text wordmark */}
        <button
          type="button"
          onClick={() => handleLink('landing', 'home')}
          className="text-left font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          Lab Equipment Fault Reporter
        </button>

        {/* Zone 2: 4-5 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => handleLink('landing', 'home')}
            className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => handleLink('landing', 'about')}
            className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            About
          </button>
          <button
            type="button"
            onClick={() => handleLink('landing', 'how-it-works')}
            className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            How It Works
          </button>
          <button
            type="button"
            onClick={() => handleLink('validation-lab')}
            className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            DFA Validation
          </button>
          <button
            type="button"
            onClick={() => handleLink(isAuthenticated ? 'dashboard' : 'auth')}
            className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isAuthenticated ? 'Dashboard' : 'Login'}
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleLink('submit')}
            className="hidden sm:inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Report a Fault
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            className="md:hidden inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-6 py-4 space-y-2">
          <button
            type="button"
            onClick={() => handleLink('landing', 'home')}
            className="block w-full text-left py-2 text-sm font-medium text-slate-700 hover:text-blue-700"
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => handleLink('landing', 'about')}
            className="block w-full text-left py-2 text-sm font-medium text-slate-700 hover:text-blue-700"
          >
            About
          </button>
          <button
            type="button"
            onClick={() => handleLink('landing', 'how-it-works')}
            className="block w-full text-left py-2 text-sm font-medium text-slate-700 hover:text-blue-700"
          >
            How It Works
          </button>
          <button
            type="button"
            onClick={() => handleLink('validation-lab')}
            className="block w-full text-left py-2 text-sm font-medium text-slate-700 hover:text-blue-700"
          >
            DFA Validation
          </button>
          <button
            type="button"
            onClick={() => handleLink(isAuthenticated ? 'dashboard' : 'auth')}
            className="block w-full text-left py-2 text-sm font-medium text-slate-700 hover:text-blue-700"
          >
            {isAuthenticated ? 'Dashboard' : 'Login / Register'}
          </button>
          <button
            type="button"
            onClick={() => handleLink('submit')}
            className="mt-2 w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Report a Fault
          </button>
        </div>
      )}
    </header>
  );
}
