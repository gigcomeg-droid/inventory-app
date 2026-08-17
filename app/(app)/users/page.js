'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/lib/apiClient';
import { formatDateTime, roleLabel } from '@/lib/formatters';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import RoleGate from '@/components/RoleGate';
import { useAuth } from '@/components/AuthContext';

const ROLES = ['ADMIN', 'MANAGER', 'STAFF', 'VIEWER'];
const emptyForm = { username: '', name: '', password: '', role: 'STAFF' };

// NOTE: CONTRACT.md documents roles/permissions for user management
// ("ADMIN: ... manage users (create/deactivate, change roles)") and the
// `/users` frontend route, but does not spell out exact `/api/users`
// request/response shapes the way it does for other resources. This page
// is built against the same REST conventions used elsewhere in the
// contract (GET/POST /api/users, PUT /api/users/[id] for role changes and
// deactivation) — flagged here and in the final integration notes in case
// the backend lands on a different shape.
export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.get('/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load users.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(u) {
    setEditing(u);
    setForm({ username: u.username, name: u.name, password: '', role: u.role });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.username.trim() || !form.name.trim() || (!editing && !form.password)) {
      setFormError('Username, name, and password are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        const payload = { name: form.name, role: form.role };
        if (form.password) payload.password = form.password;
        await apiClient.put(`/users/${editing.id}`, payload);
      } else {
        await apiClient.post('/users', form);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u) {
    try {
      await apiClient.put(`/users/${u.id}`, { isActive: !u.isActive });
      await load();
    } catch (err) {
      setError(err.message || 'Failed to update user.');
    }
  }

  const columns = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'username', header: 'Username', sortable: true, className: 'font-mono text-xs' },
    { key: 'role', header: 'Role', sortable: true, render: (r) => roleLabel(r.role) },
    {
      key: 'isActive',
      header: 'Status',
      render: (r) => (
        <span
          className={`badge ${
            r.isActive
              ? 'border border-accent-teal/30 bg-accent-teal/10 text-accent-teal'
              : 'border border-white/10 bg-white/5 text-base-100/40'
          }`}
        >
          {r.isActive ? 'Active' : 'Deactivated'}
        </span>
      ),
    },
    { key: 'createdAt', header: 'Created', render: (r) => formatDateTime(r.createdAt) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openEdit(r)}>
            Edit
          </button>
          {r.id !== currentUser?.id && (
            <button
              type="button"
              className={`btn-ghost !px-2 !py-1 text-xs ${r.isActive ? 'text-accent-rose' : 'text-accent-teal'}`}
              onClick={() => toggleActive(r)}
            >
              {r.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <RoleGate
      min="ADMIN"
      fallback={
        <div className="panel p-8 text-center">
          <h1 className="text-lg font-semibold text-white">Users</h1>
          <p className="mt-2 text-sm text-base-100/50">
            You need administrator access to manage users. Contact an admin if you believe this is
            a mistake.
          </p>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Users</h1>
            <p className="mt-1 text-sm text-base-100/50">Manage accounts, roles, and access.</p>
          </div>
          <button type="button" className="btn-primary" onClick={openCreate}>
            + Add User
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
            {error}
          </div>
        )}

        <DataTable
          columns={columns}
          data={users}
          rowKey={(r) => r.id}
          loading={loading}
          searchable
          searchKeys={['name', 'username']}
          emptyMessage="No users yet."
        />

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit User' : 'Add User'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-base-100/70">Username</span>
              <input
                className="input-field font-mono disabled:opacity-50"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                disabled={Boolean(editing)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-base-100/70">Full Name</span>
              <input className="input-field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-base-100/70">
                Password {editing && <span className="text-base-100/40">(leave blank to keep current)</span>}
              </span>
              <input
                type="password"
                className="input-field"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-base-100/70">Role</span>
              <select className="input-field" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </label>

            {formError && (
              <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-3 py-2 text-sm text-accent-rose">
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </RoleGate>
  );
}
