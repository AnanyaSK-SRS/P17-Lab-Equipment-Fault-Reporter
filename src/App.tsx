import { useCallback, useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { ReportDetailModal } from './components/ReportDetailModal';
import { AdminRoutingDashboard } from './dashboards/AdminRoutingDashboard';
import { AnalyticsDashboard } from './dashboards/AnalyticsDashboard';
import { HandlerDashboard } from './dashboards/HandlerDashboard';
import { HandlerManagementPage } from './dashboards/HandlerManagementPage';
import { UserDashboard } from './dashboards/UserDashboard';
import { AuthPage } from './pages/AuthPage';
import { LandingPage } from './pages/LandingPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ReportSubmissionPage } from './pages/ReportSubmissionPage';
import { TestResultsPage } from './pages/TestResultsPage';
import { ValidationLabPage } from './pages/ValidationLabPage';
import { api, clearAuthSession, getStoredUser } from './services/api';
import type { User } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [activeView, setActiveView] = useState<string>('landing');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await api.listNotifications(true);
      setUnreadNotifications(res.unread_count);
    } catch {
      // Ignore transient load error on initial public page
    }
  }, []);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount, user, activeView]);

  const handleNavigate = (view: string, anchor?: string) => {
    setActiveView(view);
    if (view === 'landing' && anchor) {
      setTimeout(() => {
        const el = document.getElementById(anchor);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAuthSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    if (loggedInUser.role === 'handler') {
      setActiveView('handler-desk');
    } else if (loggedInUser.role === 'admin') {
      setActiveView('routing');
    } else {
      setActiveView('dashboard');
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    setUser(null);
    setActiveView('landing');
  };

  if (activeView === 'landing') {
    return (
      <>
        <LandingPage isAuthenticated={Boolean(user)} onNavigate={handleNavigate} />
        <ReportDetailModal reportId={selectedReportId} onClose={() => setSelectedReportId(null)} />
      </>
    );
  }

  if (activeView === 'auth') {
    return <AuthPage onSuccess={handleAuthSuccess} onBack={() => handleNavigate('landing')} />;
  }

  const renderWorkspaceContent = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <UserDashboard
            user={user}
            onSelectReport={(id) => setSelectedReportId(id)}
            onNewReport={() => handleNavigate('submit')}
          />
        );
      case 'submit':
        return (
          <ReportSubmissionPage
            user={user}
            onViewReport={(id) => {
              refreshUnreadCount();
              setSelectedReportId(id);
            }}
            onGoDashboard={() => handleNavigate('dashboard')}
          />
        );
      case 'handler-desk':
        if (!user || (user.role !== 'handler' && user.role !== 'admin')) {
          return (
            <UserDashboard
              user={user}
              onSelectReport={(id) => setSelectedReportId(id)}
              onNewReport={() => handleNavigate('submit')}
            />
          );
        }
        return (
          <HandlerDashboard
            user={user}
            onSelectReport={(id) => setSelectedReportId(id)}
            onDataChanged={refreshUnreadCount}
          />
        );
      case 'routing':
        if (!user || user.role !== 'admin') {
          return (
            <UserDashboard
              user={user}
              onSelectReport={(id) => setSelectedReportId(id)}
              onNewReport={() => handleNavigate('submit')}
            />
          );
        }
        return (
          <AdminRoutingDashboard
            onSelectReport={(id) => setSelectedReportId(id)}
            onDataChanged={refreshUnreadCount}
          />
        );
      case 'handlers':
        if (!user || user.role !== 'admin') {
          return (
            <UserDashboard
              user={user}
              onSelectReport={(id) => setSelectedReportId(id)}
              onNewReport={() => handleNavigate('submit')}
            />
          );
        }
        return <HandlerManagementPage onDataChanged={refreshUnreadCount} />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'validation-lab':
        return <ValidationLabPage />;
      case 'notifications':
        return (
          <NotificationsPage
            onSelectReport={(id) => setSelectedReportId(id)}
            onNotificationsChanged={refreshUnreadCount}
          />
        );
      case 'tests':
        return <TestResultsPage />;
      default:
        return (
          <UserDashboard
            user={user}
            onSelectReport={(id) => setSelectedReportId(id)}
            onNewReport={() => handleNavigate('submit')}
          />
        );
    }
  };

  return (
    <>
      <AppShell
        user={user}
        activeView={activeView}
        unreadNotifications={unreadNotifications}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      >
        {renderWorkspaceContent()}
      </AppShell>
      <ReportDetailModal reportId={selectedReportId} onClose={() => setSelectedReportId(null)} />
    </>
  );
}
