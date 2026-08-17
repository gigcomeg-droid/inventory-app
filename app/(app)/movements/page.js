'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/apiClient';
import { formatNumber, formatDateTime, roomShortName, movementLabel } from '@/lib/formatters';
import DataTable from '@/components/DataTable';
import ImportExportBar from '@/components/ImportExportBar';

const TYPES = ['ADD', 'REMOVE', 'ADJUST', 'TRANSFER'];

export default function MovementsPage() {
  const [movements, setMovements] = useState([]);
  const [items, setItems] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [itemFilter, setItemFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const load = useCallback(async (filters = {}) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filters.itemId) params.set('itemId', filters.itemId);
      if (filters.roomId) params.set('roomId', filters.roomId);
      if (filters.type) params.set('type', filters.type);
      const data = await apiClient.get(`/movements?${params.toString()}`);
      setMovements(Array.isArray(data) ? data : data?.movements || []);
    } catch (err) {
      setError(err.message || 'Failed to load movement history.');
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    apiClient.get('/items').then(setItems).catch(() => {});
    apiClient.get('/rooms').then(setRooms).catch(() => {});
  }, []);

  useEffect(() => {
    load({ itemId: itemFilter, roomId: roomFilter, type: typeFilter });
  }, [itemFilter, roomFilter, typeFilter, load]);

  const columns = [
    { key: 'createdAt', header: 'When', sortable: true, render: (m) => formatDateTime(m.createdAt) },
    {
      key: 'item',
      header: 'Item',
      render: (m) => (
        <Link href={`/items/${m.item?.id || m.itemId}`} className="hover:text-brand-300">
          {m.item?.name || m.itemName} <span className="text-xs text-base-100/40">({m.item?.sku || m.itemSku})</span>
        </Link>
      ),
    },
    { key: 'type', header: 'Type', render: (m) => movementLabel(m.type) },
    {
      key: 'room',
      header: 'Room(s)',
      render: (m) =>
        m.type === 'TRANSFER'
          ? `${roomShortName(m.fromRoom?.code || m.fromRoomCode)} → ${roomShortName(m.toRoom?.code || m.toRoomCode)}`
          : roomShortName(m.toRoom?.code || m.fromRoom?.code || m.roomCode),
    },
    { key: 'quantity', header: 'Qty', align: 'right', render: (m) => formatNumber(m.quantity) },
    { key: 'user', header: 'By', render: (m) => m.user?.name || m.userName || '—' },
    { key: 'note', header: 'Note', render: (m) => m.note || '—' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Movement History</h1>
          <p className="mt-1 text-sm text-base-100/50">
            Every stock add, remove, adjustment, and transfer across all rooms.
          </p>
        </div>
      </div>

      <ImportExportBar exportType="movements" rooms={rooms} allowImport={false} />

      {error && (
        <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={movements}
        rowKey={(m) => m.id}
        loading={loading}
        emptyMessage="No movements recorded yet."
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <select className="input-field w-auto py-1.5 text-xs" value={itemFilter} onChange={(e) => setItemFilter(e.target.value)}>
              <option value="">All Items</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </select>
            <select className="input-field w-auto py-1.5 text-xs" value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
              <option value="">All Rooms</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {roomShortName(r.code)}
                </option>
              ))}
            </select>
            <select className="input-field w-auto py-1.5 text-xs" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {movementLabel(t)}
                </option>
              ))}
            </select>
          </div>
        }
      />
    </div>
  );
}
