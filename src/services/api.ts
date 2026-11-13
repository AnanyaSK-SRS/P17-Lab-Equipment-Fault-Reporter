import type {
  AnalyticsData,
  ClassificationResult,
  FaultReport,
  Handler,
  MaintenanceTeam,
  NotificationItem,
  ReportSummary,
  RoutingRule,
  StatusHistoryItem,
  AssignmentItem,
  TestSuiteResult,
  User,
  ValidationBundle,
} from '../types';

const TOKEN_KEY = 'lab_fault_token';
const USER_KEY = 'lab_fault_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    const err = new Error(message) as Error & { payload?: unknown; status?: number };
    err.payload = data;
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const api = {
  health: () => request<{ status: string; runtime: string; database: string; reports_count: number }>('/api/health'),

  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (payload: {
    name: string;
    email: string;
    password: string;
    role: string;
    department: string;
    user_code?: string;
  }) =>
    request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  me: () => request<{ user: User }>('/api/auth/me'),

  validateIdentifiers: (equipment_id: string, fault_code: string) =>
    request<ValidationBundle>('/api/validate', {
      method: 'POST',
      body: JSON.stringify({ equipment_id, fault_code }),
    }),

  previewClassification: (fault_code: string, fault_description: string) =>
    request<ClassificationResult>('/api/classify', {
      method: 'POST',
      body: JSON.stringify({ fault_code, fault_description }),
    }),

  submitReport: (payload: {
    reporter_name: string;
    reporter_id_code: string;
    department: string;
    lab_name: string;
    routing_zone: string;
    equipment_id: string;
    fault_code: string;
    fault_description: string;
    urgency: string;
    reported_at: string;
  }) =>
    request<{
      success: boolean;
      report_id: string;
      validation: ValidationBundle;
      classification: ClassificationResult;
      routing: {
        team_id: number;
        team_name: string;
        team_code: string;
        routing_decision: string;
        is_fallback: boolean;
        priority_level: string;
        priority_rank: number;
        priority_override: boolean;
        safety_notified: boolean;
      };
      assignment: {
        status: string;
        assigned_handler_id: number | null;
        assigned_handler_name: string | null;
        assigned_handler_code: string | null;
        is_backup_assignment: boolean;
        queue_position: number | null;
      };
    }>('/api/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listReports: (params?: {
    search?: string;
    status?: string;
    department?: string;
    category?: string;
    scope?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    if (params?.department) qs.set('department', params.department);
    if (params?.category) qs.set('category', params.category);
    if (params?.scope) qs.set('scope', params.scope);
    const query = qs.toString();
    return request<{ reports: FaultReport[]; summary: ReportSummary }>(
      `/api/reports${query ? `?${query}` : ''}`
    );
  },

  getReportDetail: (reportId: string) =>
    request<{
      report: FaultReport;
      status_history: StatusHistoryItem[];
      assignments: AssignmentItem[];
    }>(`/api/reports/${encodeURIComponent(reportId)}`),

  updateReportStatus: (reportId: string, status: string, resolution_notes: string) =>
    request<{ report: FaultReport; dispatched_from_queue: Array<{ report_id: string; handler_name: string }> }>(
      `/api/reports/${encodeURIComponent(reportId)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status, resolution_notes }),
      }
    ),

  reassignReport: (reportId: string, handler_id: number, notes: string) =>
    request<{ success: boolean; assigned_handler: Handler }>(
      `/api/reports/${encodeURIComponent(reportId)}/reassign`,
      {
        method: 'POST',
        body: JSON.stringify({ handler_id, notes }),
      }
    ),

  listHandlers: () => request<{ handlers: Handler[]; teams: MaintenanceTeam[] }>('/api/handlers'),

  createHandler: (payload: {
    name: string;
    department: string;
    specialization: string;
    max_capacity: number;
    is_available: boolean;
    backup_handler_id?: number | null;
  }) =>
    request<{ handler: Handler; dispatched_from_queue: Array<{ report_id: string; handler_name: string }> }>(
      '/api/handlers',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  updateHandler: (
    handlerId: number,
    payload: Partial<{
      name: string;
      department: string;
      specialization: string;
      is_available: boolean;
      max_capacity: number;
      backup_handler_id: number | null;
    }>
  ) =>
    request<{ handler: Handler; dispatched_from_queue: Array<{ report_id: string; handler_name: string }> }>(
      `/api/handlers/${handlerId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    ),

  routingOverview: () =>
    request<{
      routing_table: RoutingRule[];
      handlers: Handler[];
      queued_reports: FaultReport[];
      escalated_reports: FaultReport[];
      routing_history: AssignmentItem[];
    }>('/api/routing/overview'),

  processQueue: () =>
    request<{ dispatched: Array<{ report_id: string; handler_name: string }>; count: number }>(
      '/api/routing/process-queue',
      { method: 'POST' }
    ),

  analytics: (params?: {
    department?: string;
    category?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.department) qs.set('department', params.department);
    if (params?.category) qs.set('category', params.category);
    if (params?.start_date) qs.set('start_date', params.start_date);
    if (params?.end_date) qs.set('end_date', params.end_date);
    const query = qs.toString();
    return request<AnalyticsData>(`/api/analytics${query ? `?${query}` : ''}`);
  },

  listNotifications: (unreadOnly = false) =>
    request<{ notifications: NotificationItem[]; unread_count: number }>(
      `/api/notifications${unreadOnly ? '?unread_only=true' : ''}`
    ),

  markNotificationRead: (id: number) =>
    request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'PATCH' }),

  runTests: () => request<TestSuiteResult>('/api/tests/run'),
};
