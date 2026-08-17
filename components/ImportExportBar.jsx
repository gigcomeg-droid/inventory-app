'use client';

import { useRef, useState } from 'react';
import apiClient from '@/lib/apiClient';
import { roomDisplayName } from '@/lib/formatters';

/**
 * Import (CSV/XLSX upload) + Export (CSV/XLSX download) toolbar.
 *
 * - exportType: 'items' | 'movements' | 'room'
 * - roomId: current room scope (required when exportType === 'room'; also
 *   used to preselect the import target room)
 * - rooms: full room list — needed so the user can choose which room the
 *   imported quantities apply to.
 * - allowImport: set false to hide the import control (e.g. read-only views)
 */
export default function ImportExportBar({ exportType = 'items', roomId, rooms = [], allowImport = true, onImported }) {
  const fileInputRef = useRef(null);
  const [importRoomId, setImportRoomId] = useState(roomId || rooms[0]?.id || '');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleExport(format) {
    setError('');
    setExporting(format);
    try {
      const params = new URLSearchParams({ type: exportType, format });
      if (roomId) params.set('roomId', roomId);
      const res = await apiClient.raw(`/export?${params.toString()}`);
      if (!res.ok) {
        let message = `Export failed (${res.status})`;
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch (_) {}
        throw new Error(message);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename = match?.[1] || `${exportType}-export.${format}`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Export failed.');
    } finally {
      setExporting('');
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setResult(null);

    if (!importRoomId) {
      setError('Choose a room to import stock into first.');
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', importRoomId);

    setImporting(true);
    try {
      const res = await apiClient.post('/import', formData);
      setResult(res);
      onImported?.(res);
    } catch (err) {
      setError(err.message || 'Import failed.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {allowImport && (
          <>
            {rooms.length > 0 && !roomId && (
              <select
                className="input-field w-auto py-1.5 text-xs"
                value={importRoomId}
                onChange={(e) => setImportRoomId(e.target.value)}
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Import into {roomDisplayName(r.code)}
                  </option>
                ))}
              </select>
            )}
            <label className="btn-secondary cursor-pointer">
              {importing ? 'Importing…' : 'Import CSV/XLSX'}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="hidden"
                onChange={handleImport}
                disabled={importing}
              />
            </label>
          </>
        )}
        <button type="button" className="btn-secondary" onClick={() => handleExport('csv')} disabled={exporting === 'csv'}>
          {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => handleExport('xlsx')} disabled={exporting === 'xlsx'}>
          {exporting === 'xlsx' ? 'Exporting…' : 'Export XLSX'}
        </button>
      </div>

      {error && <p className="text-xs text-accent-rose">{error}</p>}

      {result && (
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-base-100/70">
          Import complete — created {result.created ?? 0}, updated {result.updated ?? 0}, skipped{' '}
          {result.skipped ?? 0}.
          {Array.isArray(result.errors) && result.errors.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-accent-rose">
              {result.errors.slice(0, 5).map((e, i) => (
                <li key={i}>{typeof e === 'string' ? e : JSON.stringify(e)}</li>
              ))}
              {result.errors.length > 5 && <li>…and {result.errors.length - 5} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
