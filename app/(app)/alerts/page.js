'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/apiClient';
import { formatDateTime, roomDisplayName } from '@/lib/formatters';
import RoleGate from '@/components/RoleGate';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);

  const load = useCallback(async (resolved) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('resolved', resolved ? 'true' : 'false');
      const data = await apiClient.get(`/alerts?${params.toString()}`);
      setAlerts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load alerts.');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(showResolved);
  }, [showResolved, load]);

  async function resolveAlert(id) {
    setResolvingId(id);
    try {
      await apiClient.post(`/alerts/${id}/resolve`);
      await load(showResolved);
    } catch (err) {
      setError(err.message || 'Failed to resolve alert.');
    } finally {
      setResolvingId(null);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map();
    alerts.forEach((a) => {
      const code = a.room?.code || a.roomCode || 'UNKNOWN';
      if (!map.has(code)) map.set(code, []);
      map.get(code).push(a);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [alerts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Alerts</h1>
          <p className="mt-1 text-sm text-base-100/50">Low-stock and out-of-stock alerts, grouped by room.</p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-base-100/60">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-white/20 bg-base-950 text-brand-500 focus:ring-brand-500"
          />
          Show resolved
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-base-100/40">Loading alerts…</p>
      ) : alerts.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="text-sm text-base-100/50">
            {showResolved ? 'No resolved alerts.' : 'No open alerts — everything is well-stocked.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([code, roomAlerts]) => (
            <div key={code} className="panel p-5">
              <h3 className="mb-3 text-sm font-semibold text-white">{roomDisplayName(code)}</h3>
              <ul className="divide-y divide-white/5">
                {roomAlerts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-base-100/90">
                        <Link href={`/items/${a.item?.id || a.itemId}`} className="font-medium hover:text-brand-300">
                          {a.item?.name || a.itemName || 'Item'}
                        </Link>{' '}
                        <span
                          className={`badge ml-1 ${
                            a.type === 'OUT_OF_STOCK'
                              ? 'border border-accent-rose/30 bg-accent-rose/10 text-accent-rose'
                              : 'border border-accent-amber/30 bg-accent-amber/10 text-accent-amber'
                          }`}
                        >
                          {a.type === 'OUT_OF_STOCK' ? 'Out of Stock' : 'Low Stock'}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-base-100/40">
                        {a.message} · {formatDateTime(a.createdAt)}
                        {a.isResolved && a.resolvedAt ? ` · resolved ${formatDateTime(a.resolvedAt)}` : ''}
                      </p>
                    </div>
                    {!a.isResolved && (
                      <RoleGate min="MANAGER">
                        <button
                          type="button"
                          className="btn-secondary shrink-0"
                          onClick={() => resolveAlert(a.id)}
                          disabled={resolvingId === a.id}
                        >
                          {resolvingId === a.id ? 'Resolving…' : 'Resolve'}
                        </button>
                      </RoleGate>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
