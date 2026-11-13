import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, Wrench } from 'lucide-react';
import type { ReportCategory, ReportStatus, UrgencyLevel } from '../types';

export function StatusIndicator({ status }: { status: ReportStatus | string }) {
  switch (status) {
    case 'Resolved':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Resolved
        </span>
      );
    case 'In Progress':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800 whitespace-nowrap">
          <Wrench className="h-3.5 w-3.5 text-blue-600" />
          In Progress
        </span>
      );
    case 'Assigned':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-800 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 text-indigo-600" />
          Assigned
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 text-amber-600" />
          Pending
        </span>
      );
  }
}

export function PriorityIndicator({ level }: { level: UrgencyLevel | string }) {
  switch (level) {
    case 'Emergency/Critical':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800 whitespace-nowrap">
          <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
          Emergency/Critical
        </span>
      );
    case 'High':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 whitespace-nowrap">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          High
        </span>
      );
    case 'Medium':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 whitespace-nowrap">
          Medium
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600 whitespace-nowrap">
          Low
        </span>
      );
  }
}

export function CategoryText({ category }: { category: ReportCategory | string }) {
  if (category === 'Safety') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 whitespace-nowrap">
        <ShieldAlert className="h-3.5 w-3.5" />
        Safety
      </span>
    );
  }
  return <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{category}</span>;
}
