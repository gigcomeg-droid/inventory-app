'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/lib/apiClient';
import { formatDateTime } from '@/lib/formatters';
import DataTable from '@/components/DataTable';
import RoleGate from '@/components/RoleGate';
import { useLocale } from '@/components/LocaleContext';

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function BackupsPage() {
  const { t, locale } = useLocale();
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.get('/backups');
      setSnapshots(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || t('backups.loadFailed'));
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    setCreating(true);
    setError('');
    try {
      await apiClient.post('/backups');
      await load();
    } catch (err) {
      setError(err.message || t('backups.createFailed'));
    } finally {
      setCreating(false);
    }
  }

  async function handleDownload(snapshot) {
    try {
      const res = await apiClient.raw(`/backups/${snapshot.id}/download`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-backup-${snapshot.createdAt.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || t('backups.downloadFailed'));
    }
  }

  const columns = [
    {
      key: 'createdAt',
      header: t('backups.colDate'),
      render: (r) => formatDateTime(r.createdAt, locale),
      className: 'whitespace-nowrap',
    },
    { key: 'triggeredBy', header: t('backups.colTriggeredBy'), render: (r) => r.triggeredBy || '—' },
    { key: 'summary', header: t('backups.colContents') },
    { key: 'sizeBytes', header: t('backups.colSize'), align: 'right', render: (r) => formatBytes(r.sizeBytes) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => handleDownload(r)}>
          {t('backups.download')}
        </button>
      ),
    },
  ];

  return (
    <RoleGate
      min="ADMIN"
      fallback={
        <div className="panel p-8 text-center">
          <h1 className="text-lg font-semibold text-white">{t('backups.title')}</h1>
          <p className="mt-2 text-sm text-base-100/50">
            {t('backups.needAdmin')}
          </p>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">{t('backups.title')}</h1>
            <p className="mt-1 max-w-2xl text-sm text-base-100/50">
              {t('backups.subtitle')}
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={handleCreate} disabled={creating}>
            {creating ? t('backups.creating') : t('backups.createNow')}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
            {error}
          </div>
        )}

        <DataTable
          columns={columns}
          data={snapshots}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage={t('backups.empty')}
        />
      </div>
    </RoleGate>
  );
}
