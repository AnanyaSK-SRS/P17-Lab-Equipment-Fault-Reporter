import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Edit3, Plus, Power } from 'lucide-react';
import { api } from '../services/api';
import type { Handler } from '../types';

interface HandlerManagementPageProps {
  onDataChanged: () => void;
}

export function HandlerManagementPage({ onDataChanged }: HandlerManagementPageProps) {
  const [handlers, setHandlers] = useState<Handler[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Add handler form
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('ECE');
  const [specialization, setSpecialization] = useState('');
  const [maxCapacity, setMaxCapacity] = useState(4);
  const [backupId, setBackupId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<Handler | null>(null);
  const [editName, setEditName] = useState('');
  const [editSpec, setEditSpec] = useState('');
  const [editCapacity, setEditCapacity] = useState(4);
  const [editBackupId, setEditBackupId] = useState<string>('');

  const loadHandlers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listHandlers();
      setHandlers(res.handlers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load handlers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHandlers();
  }, [loadHandlers]);

  const handleAddHandler = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.createHandler({
        name,
        department,
        specialization: specialization || `${department} Equipment Maintenance`,
        max_capacity: Number(maxCapacity),
        is_available: true,
        backup_handler_id: backupId ? Number(backupId) : null,
      });
      setMessage(
        `Added handler ${res.handler.name} (${res.handler.handler_code}).` +
          (res.dispatched_from_queue.length > 0
            ? ` Dispatched ${res.dispatched_from_queue.length} queued report(s).`
            : '')
      );
      setName('');
      setSpecialization('');
      setMaxCapacity(4);
      setBackupId('');
      await loadHandlers();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create handler.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailability = async (handler: Handler) => {
    setError(null);
    setMessage(null);
    try {
      const res = await api.updateHandler(handler.id, {
        is_available: handler.is_available === 0,
      });
      setMessage(
        `${res.handler.name} marked ${res.handler.is_available ? 'Available' : 'Unavailable'}.` +
          (res.dispatched_from_queue.length > 0
            ? ` Auto-dispatched ${res.dispatched_from_queue.length} queued report(s).`
            : '')
      );
      await loadHandlers();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update availability.');
    }
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    setMessage(null);
    try {
      const res = await api.updateHandler(editing.id, {
        name: editName,
        specialization: editSpec,
        max_capacity: Number(editCapacity),
        backup_handler_id: editBackupId ? Number(editBackupId) : null,
      });
      setMessage(`Updated handler ${res.handler.name}.`);
      setEditing(null);
      await loadHandlers();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save handler updates.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Handler Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          Configure maintenance technicians, availability status, maximum active capacity, and backup
          failover assignments.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Add Handler Form */}
      <form
        onSubmit={handleAddHandler}
        className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
      >
        <div className="text-sm font-display font-bold text-slate-900">Add Maintenance Handler</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Handler Full Name"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="ECE">ECE (Electronics Lab)</option>
            <option value="MECH">MECH (Mechanical Lab)</option>
            <option value="CSE">CSE (IT Lab)</option>
            <option value="CENTRAL">CENTRAL (Central Stores)</option>
          </select>
          <input
            type="text"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder="Specialization (e.g., CNC & Hydraulics)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={1}
            max={20}
            value={maxCapacity}
            onChange={(e) => setMaxCapacity(Number(e.target.value))}
            placeholder="Max Capacity"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
          />
          <select
            value={backupId}
            onChange={(e) => setBackupId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Default Backup (Central)</option>
            {handlers.map((h) => (
              <option key={h.id} value={h.id}>
                Backup: {h.name} ({h.department})
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Handler
          </button>
        </div>
      </form>

      {/* Handlers Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Handler ID</th>
                <th className="px-4 py-3">Name & Specialization</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Backup Handler</th>
                <th className="px-4 py-3">Workload / Capacity</th>
                <th className="px-4 py-3">Availability</th>
                <th className="px-4 py-3 text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading handlers...
                  </td>
                </tr>
              )}
              {!loading &&
                handlers.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-800">
                      {h.handler_code}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{h.name}</div>
                      <div className="text-xs text-slate-500">{h.specialization}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {h.team_name} ({h.department})
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {h.backup_handler_name || 'Central Stores Pool'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums">
                      <span
                        className={
                          h.current_workload >= h.max_capacity
                            ? 'font-bold text-red-700'
                            : 'font-semibold text-slate-900'
                        }
                      >
                        {h.current_workload} / {h.max_capacity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 font-medium ${
                          h.is_available
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-red-200 bg-red-50 text-red-800'
                        }`}
                      >
                        {h.is_available ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(h)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Power className="h-3.5 w-3.5" />
                          {h.is_available ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(h);
                            setEditName(h.name);
                            setEditSpec(h.specialization);
                            setEditCapacity(h.max_capacity);
                            setEditBackupId(h.backup_handler_id ? String(h.backup_handler_id) : '');
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl"
          >
            <h3 className="font-display text-lg font-bold text-slate-900">
              Edit Handler {editing.handler_code}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Specialization
              </label>
              <input
                type="text"
                required
                value={editSpec}
                onChange={(e) => setEditSpec(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Maximum Capacity
              </label>
              <input
                type="number"
                min={1}
                max={25}
                value={editCapacity}
                onChange={(e) => setEditCapacity(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Backup Handler
              </label>
              <select
                value={editBackupId}
                onChange={(e) => setEditBackupId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">None (Use Central Stores Pool)</option>
                {handlers
                  .filter((h) => h.id !== editing.id)
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.department})
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
