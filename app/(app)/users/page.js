'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/lib/apiClient';
import { formatDateTime, roleLabel } from '@/lib/formatters';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import RoleGate from '@/components/RoleGate';
import { useAuth } from '@/components/AuthContext';
import { useLocale } from '@/components/LocaleContext';

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
  const { t, locale } = useLocale();
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
      setError(err.message || t('users.loadFailed'));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      setFormError(t('users.requiredFields'));
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
      setFormError(err.message || t('users.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u) {
    try {
      await apiClient.put(`/users/${u.id}`, { isActive: !u.isActive });
      await load();
    } catch (err) {
      setError(err.message || t('users.updateFailed'));
    }
  }

  const columns = [
    { key: 'name', header: t('users.colName'), sortable: true },
    { key: 'username', header: t('users.colUsername'), sortable: true, className: 'font-mono text-xs' },
    { key: 'role', header: t('users.colRole'), sortable: true, render: (r) => roleLabel(r.role, locale) },
    {
      key: 'isActive',
      header: t('users.colStatus'),
      render: (r) => (
        <span
          className={`badge ${
            r.isActive
              ? 'border border-accent-teal/30 bg-accent-teal/10 text-accent-teal'
              : 'border border-white/10 bg-white/5 text-base-100/40'
          }`}
        >
          {r.isActive ? t('users.active') : t('users.deactivated')}
        </span>
      ),
    },
    { key: 'createdAt', header: t('users.colCreated'), render: (r) => formatDateTime(r.createdAt, locale) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openEdit(r)}>
            {t('users.edit')}
          </button>
          {r.id !== currentUser?.id && (
            <button
              type="button"
              className={`btn-ghost !px-2 !py-1 text-xs ${r.isActive ? 'text-accent-rose' : 'text-accent-teal'}`}
              onClick={() => toggleActive(r)}
            >
              {r.isActive ? t('users.deactivate') : t('users.reactivate')}
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
          <h1 className="text-lg font-semibold text-white">{t('users.title')}</h1>
          <p className="mt-2 text-sm text-base-100/50">{t('users.needAdmin')}</p>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">{t('users.title')}</h1>
            <p className="mt-1 text-sm text-base-100/50">{t('users.subtitle')}</p>
          </div>
          <button type="button" className="btn-primary" onClick={openCreate}>
            {t('users.addNew')}
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
          emptyMessage={t('users.empty')}
        />

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('users.editTitle') : t('users.addTitle')}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('users.username')}</span>
              <input
                className="input-field font-mono disabled:opacity-50"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                disabled={Boolean(editing)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('users.fullName')}</span>
              <input className="input-field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-base-100/70">
                {t('users.password')} {editing && <span className="text-base-100/40">{t('users.passwordKeepCurrent')}</span>}
              </span>
              <input
                type="password"
                className="input-field"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('users.role')}</span>
              <select className="input-field" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r, locale)}
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
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? t('users.saving') : editing ? t('users.saveChanges') : t('users.createUser')}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </RoleGate>
  );
}
