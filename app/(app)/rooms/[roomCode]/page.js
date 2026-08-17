'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '@/lib/apiClient';
import { roomDisplayName, formatNumber } from '@/lib/formatters';
import DataTable from '@/components/DataTable';
import LowStockBadge from '@/components/LowStockBadge';
import StockActionModal from '@/components/StockActionModal';
import ItemFormModal from '@/components/ItemFormModal';
import RoleGate from '@/components/RoleGate';

export default function RoomPage({ params }) {
  const roomCode = params.roomCode?.toUpperCase();

  const [rooms, setRooms] = useState([]);
  const [room, setRoom] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [stockModal, setStockModal] = useState({ open: false, action: 'add', item: null, currentQuantity: undefined });

  const loadRooms = useCallback(async () => {
    try {
      const roomsData = await apiClient.get('/rooms');
      setRooms(roomsData || []);
      const match = (roomsData || []).find((r) => r.code === roomCode);
      setRoom(match || null);
      return match;
    } catch (err) {
      setError(err.message || 'Failed to load rooms.');
      return null;
    }
  }, [roomCode]);

  const loadInventory = useCallback(async (roomId, filters = {}) => {
    if (!roomId) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.category) params.set('category', filters.category);
      if (filters.lowStockOnly) params.set('lowStockOnly', 'true');
      const data = await apiClient.get(`/rooms/${roomId}/inventory?${params.toString()}`);
      setInventory(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load room inventory.');
      setInventory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const match = await loadRooms();
      apiClient.get('/categories').then(setCategories).catch(() => {});
      if (match?.id) await loadInventory(match.id, {});
      else setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  useEffect(() => {
    if (!room?.id) return;
    const handle = setTimeout(() => {
      loadInventory(room.id, { search, category: categoryFilter, lowStockOnly });
    }, 300);
    return () => clearTimeout(handle);
  }, [room?.id, search, categoryFilter, lowStockOnly, loadInventory]);

  const lowStockCount = useMemo(() => inventory.filter((i) => i.isLowStock).length, [inventory]);

  function refreshInventory() {
    if (room?.id) loadInventory(room.id, { search, category: categoryFilter, lowStockOnly });
  }

  function openStockModal(action, row) {
    setStockModal({
      open: true,
      action,
      item: { id: row.itemId, name: row.name, sku: row.sku },
      currentQuantity: row.quantity,
    });
  }

  const columns = [
    { key: 'name', header: 'Item', sortable: true },
    { key: 'sku', header: 'SKU', sortable: true, className: 'font-mono text-xs' },
    { key: 'category', header: 'Category', sortable: true, render: (r) => r.category || '—' },
    {
      key: 'quantity',
      header: 'Quantity',
      sortable: true,
      align: 'right',
      render: (r) => (
        <span className="font-medium">
          {formatNumber(r.quantity)} <span className="text-xs text-base-100/40">{r.unit}</span>
        </span>
      ),
    },
    { key: 'minStockLevel', header: 'Min Level', sortable: true, align: 'right' },
    {
      key: 'isLowStock',
      header: 'Status',
      render: (r) => <LowStockBadge quantity={r.quantity} minStockLevel={r.minStockLevel} isLowStock={r.isLowStock} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <RoleGate min="STAFF">
          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openStockModal('add', r)}>
              Add
            </button>
            <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openStockModal('remove', r)}>
              Remove
            </button>
            <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openStockModal('adjust', r)}>
              Adjust
            </button>
            <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openStockModal('transfer', r)}>
              Transfer
            </button>
          </div>
        </RoleGate>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            {room ? roomDisplayName(room.code) : roomDisplayName(roomCode)}
          </h1>
          <p className="mt-1 text-sm text-base-100/50">
            {room?.location ? `${room.location} · ` : ''}
            {formatNumber(inventory.length)} item{inventory.length === 1 ? '' : 's'} tracked in this room only.
          </p>
        </div>
        <RoleGate min="STAFF">
          <button type="button" className="btn-primary" onClick={() => setItemModalOpen(true)}>
            + Add New Item
          </button>
        </RoleGate>
      </div>

      {lowStockCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-4 py-3 text-sm text-accent-amber">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <path d="M12 3l9 16H3l9-16zM12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {lowStockCount} item{lowStockCount === 1 ? '' : 's'} low on stock in this room.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={inventory}
        rowKey={(r) => r.itemId}
        loading={loading}
        emptyMessage="No items in this room yet."
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-xs">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-100/40"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search this room…"
                className="input-field pl-9"
              />
            </div>
            <select
              className="input-field w-auto py-1.5 text-xs"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-base-100/60">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/20 bg-base-950 text-brand-500 focus:ring-brand-500"
              />
              Low stock only
            </label>
          </div>
        }
      />

      <ItemFormModal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        defaultRoomId={room?.id}
        onSaved={refreshInventory}
      />

      <StockActionModal
        open={stockModal.open}
        onClose={() => setStockModal((s) => ({ ...s, open: false }))}
        action={stockModal.action}
        item={stockModal.item}
        roomId={room?.id}
        rooms={rooms}
        currentQuantity={stockModal.currentQuantity}
        onSaved={refreshInventory}
      />
    </div>
  );
}

