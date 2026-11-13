export type UserRole = 'reporter' | 'handler' | 'admin';

export type DepartmentCode = 'ECE' | 'MECH' | 'CSE' | 'CENTRAL';

export type ReportCategory = 'Safety' | 'Hardware' | 'Calibration' | 'Software' | 'Consumable';

export type UrgencyLevel = 'Emergency/Critical' | 'High' | 'Medium' | 'Low';

export type ReportStatus = 'Pending' | 'Assigned' | 'In Progress' | 'Resolved';

export interface User {
  id: number;
  user_code: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  created_at?: string;
}

export interface DFATransitionStep {
  step: number;
  char: string;
  from_state: string;
  to_state: string;
  accepted_so_far: boolean;
}

export interface IdentifierValidationDetail {
  valid: boolean;
  agreement: boolean;
  department_extracted?: string | null;
  error_message: string | null;
  dfa: {
    valid: boolean;
    input_value: string;
    final_state: string;
    accepting_states: string[];
    error_message: string | null;
    error_position: number | null;
    transitions: DFATransitionStep[];
    extracted_department?: string | null;
  };
  regex: {
    valid: boolean;
    input_value: string;
    pattern: string;
    error_message: string | null;
    captured_groups?: Record<string, string> | null;
  };
}

export interface ValidationBundle {
  valid: boolean;
  dfa_valid: boolean;
  regex_valid: boolean;
  agreement: boolean;
  equipment_id: IdentifierValidationDetail;
  fault_code: IdentifierValidationDetail;
  errors: string[];
}

export interface ClassificationResult {
  category: ReportCategory;
  confidence: string;
  reason: string;
  matched_categories: ReportCategory[];
  conflict_resolved: boolean;
  unmapped_code: boolean;
  needs_manual_review: boolean;
  evidence: string[];
}

export interface FaultReport {
  id: number;
  report_id: string;
  reporter_user_id: number | null;
  reporter_name: string;
  reporter_id_code: string;
  department: string;
  lab_name: string;
  routing_zone: string;
  equipment_id: string;
  fault_code: string;
  fault_description: string;
  urgency: UrgencyLevel;
  reported_at: string;
  dfa_valid: number;
  dfa_trace: string;
  regex_valid: number;
  validation_agreement: number;
  detected_category: ReportCategory;
  classification_reason: string;
  classification_confidence: string;
  priority_level: UrgencyLevel;
  priority_rank: number;
  priority_override: number;
  routing_decision: string;
  assigned_team_id: number | null;
  assigned_team_name?: string | null;
  assigned_team_code?: string | null;
  assigned_handler_id: number | null;
  assigned_handler_name?: string | null;
  assigned_handler_code?: string | null;
  status: ReportStatus;
  resolution_notes: string;
  created_at: string;
  updated_at: string;
}

export interface ReportSummary {
  total: number;
  pending: number;
  assigned: number;
  in_progress: number;
  resolved: number;
}

export interface StatusHistoryItem {
  id: number;
  report_id: string;
  old_status: string | null;
  new_status: string;
  changed_by_user_id: number | null;
  changed_by_name: string;
  notes: string;
  changed_at: string;
}

export interface AssignmentItem {
  id: number;
  report_id: string;
  handler_id: number | null;
  handler_name?: string | null;
  team_id: number;
  team_name?: string;
  assigned_by: string;
  is_backup_assignment: number;
  priority_override: number;
  routing_decision: string;
  assigned_at: string;
  active: number;
  department?: string;
  equipment_id?: string;
  priority_level?: string;
}

export interface Handler {
  id: number;
  handler_code: string;
  user_id: number | null;
  name: string;
  department: string;
  team_id: number;
  team_name?: string;
  team_code?: string;
  specialization: string;
  is_available: number;
  max_capacity: number;
  current_workload: number;
  backup_handler_id: number | null;
  backup_handler_name?: string | null;
}

export interface MaintenanceTeam {
  id: number;
  team_code: string;
  team_name: string;
  department: string;
  description: string;
  safety_officer_email: string;
}

export interface RoutingRule {
  id: number;
  routing_key: string;
  department: string;
  zone: string;
  team_id: number;
  team_name: string;
  team_code: string;
  priority_weight: number;
  is_fallback: number;
  description: string;
  safety_officer_email: string;
}

export interface NotificationItem {
  id: number;
  report_id: string | null;
  recipient_role: string;
  recipient_name: string;
  notification_type: string;
  severity: 'critical' | 'high' | 'warning' | 'info';
  title: string;
  message: string;
  is_read: number;
  created_at: string;
}

export interface AnalyticsData {
  totals: {
    total: number;
    resolved: number;
    unresolved: number;
  };
  by_category: Array<{ label: string; count: number }>;
  by_department: Array<{ label: string; count: number }>;
  by_zone: Array<{ label: string; count: number }>;
  by_priority: Array<{ label: string; count: number }>;
  by_month: Array<{ label: string; count: number }>;
}

export interface TestSuiteResult {
  total: number;
  passed: number;
  failed: number;
  all_passed: boolean;
  tests: Array<{
    name: string;
    label: string;
    passed: boolean;
    error: string;
  }>;
}
