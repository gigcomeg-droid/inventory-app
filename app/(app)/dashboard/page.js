'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/apiClient';
import { formatNumber, roomShortName } from '@/lib/formatters';
import KpiCard from '@/components/KpiCard';
import { StockByRoomChart, TopLowStockChart, MovementTrendChart } from '@/components/ChartCards';
import LowStockBadge from '@/components/LowStockBadge';

const ICONS = {
  items: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 7l8-4 8 4-8 4-8-4zM4 7v10l8 4m0-10v10m8-10v10l-8-4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  units: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 9l9-6 9 6-9 6-9-6zM3 9v6l9 6 9-6V9" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  alerts: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l9 16H3l9-16zM12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  suppliers: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 9l2-5h14l2 5M3 9v10a1 1 0 001 1h16a1 1 0 001-1V9M3 9h18M9 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export default function DashboardPage() {
  const [rooms, setRooms] = useState([]);
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [roomsRes, itemsRes, alertsRes, suppliersRes, categoriesRes, movementsRes] =
          await Promise.allSettled([
            apiClient.get('/rooms'),
            apiClient.get('/items'),
            apiClient.get('/alerts?resolved=false'),
            apiClient.get('/suppliers'),
            apiClient.get('/categories'),
            apiClient.get('/movements?limit=50'),
          ]);
        if (cancelled) return;

        if (roomsRes.status === 'fulfilled') setRooms(roomsRes.value || []);
        if (itemsRes.status === 'fulfilled') setItems(itemsRes.value || []);
        if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value || []);
        if (suppliersRes.status === 'fulfilled') setSuppliers(suppliersRes.value || []);
        if (categoriesRes.status === 'fulfilled') setCategories(categoriesRes.value || []);
        if (movementsRes.status === 'fulfilled')
          setMovements(Array.isArray(movementsRes.value) ? movementsRes.value : movementsRes.value?.items || []);

        const failures = [roomsRes, itemsRes, alertsRes, suppliersRes, categoriesRes, movementsRes].filter(
          (r) => r.status === 'rejected'
        );
        if (failures.length > 0 && roomsRes.status === 'rejected' && itemsRes.status === 'rejected') {
          setError('Could not load dashboard data. The API may not be available yet.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalItems = items.length;
  const totalUnits = useMemo(
    () => items.reduce((sum, it) => sum + (it.totalQuantity || 0), 0),
    [items]
  );
  const totalLowStockAlerts = alerts.length;

  const stockByRoomData = useMemo(
    () => rooms.map((r) => ({ room: roomShortName(r.code), quantity: r.totalUnits || 0 })),
    [rooms]
  );

  const topLowStockData = useMemo(() => {
    const flattened = [];
    items.forEach((item) => {
      (item.perRoom || []).forEach((pr) => {
        if (pr.isLowStock) {
          flattened.push({
            name: item.name,
            quantity: pr.quantity,
            minStockLevel: pr.minStockLevel,
          });
        }
      });
    });
    return flattened.sort((a, b) => a.quantity - b.quantity).slice(0, 8);
  }, [items]);

  const movementTrendData = useMemo(() => {
    const buckets = new Map();
    movements.forEach((m) => {
      const d = new Date(m.createdAt);
      if (Number.isNaN(d.getTime())) return;
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!buckets.has(label)) buckets.set(label, { label, add: 0, remove: 0 });
      const bucket = buckets.get(label);
      if (m.type === 'ADD') bucket.add += m.quantity || 0;
      if (m.type === 'REMOVE') bucket.remove += m.quantity || 0;
      if (m.type === 'TRANSFER') bucket.add += m.quantity || 0;
    });
    return Array.from(buckets.values()).slice(-10);
  }, [movements]);

  const recentAlerts = alerts.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-base-100/50">
            Live overview across all 4 storage rooms.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-4 py-3 text-sm text-accent-amber">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Items" value={formatNumber(totalItems)} icon={ICONS.items} accent="brand" loading={loading} />
        <KpiCard label="Total Units (All Rooms)" value={formatNumber(totalUnits)} icon={ICONS.units} accent="teal" loading={loading} />
        <KpiCard
          label="Low-Stock Alerts"
          value={formatNumber(totalLowStockAlerts)}
          icon={ICONS.alerts}
          accent={totalLowStockAlerts > 0 ? 'rose' : 'teal'}
          loading={loading}
        />
        <KpiCard
          label="Suppliers / Categories"
          value={`${formatNumber(suppliers.length)} / ${formatNumber(categories.length)}`}
          icon={ICONS.suppliers}
          accent="purple"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StockByRoomChart data={stockByRoomData} loading={loading} />
        <TopLowStockChart data={topLowStockData} loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <MovementTrendChart data={movementTrendData} loading={loading} />

        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Recent Alerts</h3>
            <Link href="/alerts" className="text-xs text-brand-300 hover:text-brand-200">
              View all
            </Link>
          </div>
          {loading ? (
            <p className="text-sm text-base-100/40">Loading…</p>
          ) : recentAlerts.length === 0 ? (
            <p className="text-sm text-base-100/40">No open alerts. Everything looks well-stocked.</p>
          ) : (
            <ul className="space-y-2.5">
              {recentAlerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-base-100/90">{a.item?.name || a.message}</p>
                    <p className="truncate text-xs text-base-100/40">{roomShortName(a.room?.code)}</p>
                  </div>
                  <LowStockBadge quantity={0} minStockLevel={0} isLowStock />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
