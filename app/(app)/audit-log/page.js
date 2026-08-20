'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/lib/apiClient';
import { formatDateTime, auditActionLabel } from '@/lib/formatters';
import DataTable from '@/components/DataTable';
import RoleGate from '@/components/RoleGate';
import { useLocale } from '@/components/LocaleContext';

const emptyFilters = { userId: '', action: '', from: '', to: '' };

export default function AuditLogPage() {
  const { t, locale } = useLocale();
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [filterOptions, setFilterOptions] = useState({ users: [], actions: [] });

  useEffect(() => {
    apiClient
      .get('/audit-log?meta=filters')
      .then((data) =>
        setFilterOptions({
          users: Array.isArray(data?.users) ? data.users : [],
          actions: Array.isArray(data?.actions) ? data.actions : [],
        })
      )
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.action) params.set('action', filters.action);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);

      const data = await apiClient.get(`/audit-log?${params.toString()}`);
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
      setTotal(data?.total || 0);
    } catch (err) {
      setError(err.message || t('auditLog.loadFailed'));
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  function updateFilter(key, value) {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function clearFilters() {
    setPage(1);
    setFilters(emptyFilters);
  }

  const hasFilters = Object.values(filters).some(Boolean);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns = [
    {
      key: 'createdAt',
      header: t('auditLog.colWhen'),
      render: (r) => formatDateTime(r.createdAt, locale),
      className: 'whitespace-nowrap',
    },
    {
      key: 'user',
      header: t('auditLog.colWho'),
      render: (r) =>
        r.user ? (
          <span>
            {r.user.name} <span className="text-base-100/40">({r.user.username})</span>
          </span>
        ) : (
          <span className="text-base-100/40">{t('auditLog.unknownSystem')}</span>
        ),
    },
    {
      key: 'action',
      header: t('auditLog.colAction'),
      render: (r) => (
        <span className="badge border border-white/10 bg-white/5">{auditActionLabel(r.action, locale)}</span>
      ),
    },
    { key: 'details', header: t('auditLog.colDetails'), render: (r) => r.details || '—' },
  ];

  return (
    <RoleGate
      min="ADMIN"
      fallback={
        <div className="panel p-8 text-center">
          <h1 className="text-lg font-semibold text-white">{t('auditLog.title')}</h1>
          <p className="mt-2 text-sm text-base-100/50">{t('auditLog.needAdmin')}</p>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">{t('auditLog.title')}</h1>
          <p className="mt-1 text-sm text-base-100/50">{t('auditLog.subtitle')}</p>
        </div>

        <div className="panel flex flex-wrap items-end gap-3 p-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('auditLog.user')}</span>
            <select
              className="input-field"
              value={filters.userId}
              onChange={(e) => updateFilter('userId', e.target.value)}
            >
              <option value="">{t('auditLog.allUsers')}</option>
              {filterOptions.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.username})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('auditLog.action')}</span>
            <select
              className="input-field"
              value={filters.action}
              onChange={(e) => updateFilter('action', e.target.value)}
            >
              <option value="">{t('auditLog.allActions')}</option>
              {filterOptions.actions.map((a) => (
                <option key={a} value={a}>
                  {auditActionLabel(a, locale)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('auditLog.from')}</span>
            <input
              type="date"
              className="input-field"
              value={filters.from}
              onChange={(e) => updateFilter('from', e.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('auditLog.to')}</span>
            <input
              type="date"
              className="input-field"
              value={filters.to}
              onChange={(e) => updateFilter('to', e.target.value)}
            />
          </label>

          {hasFilters && (
            <button type="button" className="btn-secondary" onClick={clearFilters}>
              {t('auditLog.clearFilters')}
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
            {error}
          </div>
        )}

        <DataTable
          columns={columns}
          data={entries}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage={t('auditLog.empty')}
        />

        {total > 0 && (
          <div className="flex items-center justify-between text-sm text-base-100/50">
            <span>
              {t('auditLog.showing', {
                from: (page - 1) * pageSize + 1,
                to: Math.min(page * pageSize, total),
                total,
              })}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost !px-3 !py-1.5 text-xs disabled:opacity-30"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                {t('auditLog.previous')}
              </button>
              <button
                type="button"
                className="btn-ghost !px-3 !py-1.5 text-xs disabled:opacity-30"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                {t('auditLog.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </RoleGate>
  );
}
