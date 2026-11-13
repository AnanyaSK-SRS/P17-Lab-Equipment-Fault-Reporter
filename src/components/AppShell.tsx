import { useState, type ReactNode } from 'react';
import {
  BarChart3,
  Bell,
  CheckSquare,
  Cpu,
  FilePlus2,
  GitFork,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import type { User } from '../types';

export interface NavItem {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: Array<'reporter' | 'handler' | 'admin'>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Reports Overview', icon: LayoutDashboard },
  { id: 'submit', label: 'Submit Fault Report', icon: FilePlus2 },
  { id: 'handler-desk', label: 'Handler Workbench', icon: Wrench, roles: ['handler', 'admin'] },
  { id: 'routing', label: 'Routing & Dispatch', icon: GitFork, roles: ['admin'] },
  { id: 'handlers', label: 'Handler Management', icon: Users, roles: ['admin'] },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'validation-lab', label: 'DFA & Regex Lab', icon: Cpu },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'tests', label: 'Test Suite Results', icon: CheckSquare },
];

interface AppShellProps {
  user: User | null;
  activeView: string;
  unreadNotifications: number;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({
  user,
  activeView,
  unreadNotifications,
  onNavigate,
  onLogout,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  const currentItem = NAV_ITEMS.find((n) => n.id === activeView);

  const renderSidebarBody = () => (
    <div className="flex h-full flex-col bg-[#0B1D3A] text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <button
          type="button"
          onClick={() => {
            setDrawerOpen(false);
            onNavigate('landing');
          }}
          className="text-left focus:outline-none cursor-pointer"
        >
          <span className="block font-display text-base font-bold tracking-tight text-white">
            Lab Fault Reporter
          </span>
          <span className="block text-xs text-slate-400">Campus Lab Operations</span>
        </button>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          className="lg:hidden rounded p-1 text-slate-300 hover:bg-slate-800"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <button
          type="button"
          onClick={() => {
            setDrawerOpen(false);
            onNavigate('landing');
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white transition-colors cursor-pointer"
        >
          <Home className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">Portal Home</span>
        </button>

        <div className="my-2 border-t border-slate-800" />

        {visibleNav.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                onNavigate(item.id);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                active
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === 'notifications' && unreadNotifications > 0 && (
                <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums">
                  {unreadNotifications}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-4">
        {user ? (
          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold text-white truncate">{user.name}</div>
              <div className="text-xs text-slate-400 truncate">
                {user.role.toUpperCase()} · {user.department}
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate('auth')}
            className="w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 transition-colors cursor-pointer"
          >
            Sign In / Register
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0">
        <div className="sticky top-0 h-screen">{renderSidebarBody()}</div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-72 max-w-[85vw] h-full shadow-xl">{renderSidebarBody()}</div>
          <button
            type="button"
            aria-label="Dismiss menu"
            className="flex-1 bg-slate-900/50"
            onClick={() => setDrawerOpen(false)}
          />
        </div>
      )}

      {/* Main viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-8 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
              <span className="hidden sm:inline">Workspace</span>
              <span className="hidden sm:inline" aria-hidden="true">/</span>
              <span className="font-display font-semibold text-slate-900 truncate">
                {currentItem?.label || 'Lab Portal'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('notifications')}
              className="relative inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Bell className="h-3.5 w-3.5 text-slate-600" />
              <span className="hidden sm:inline">Alerts</span>
              {unreadNotifications > 0 && (
                <span className="rounded bg-red-600 px-1.5 py-0.2 text-[11px] font-semibold text-white tabular-nums">
                  {unreadNotifications}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('submit')}
              className="rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              New Fault Report
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
