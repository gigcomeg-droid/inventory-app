'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/apiClient';
import { formatNumber, formatDateTime, roomShortName, movementLabel } from '@/lib/formatters';
import DataTable from '@/components/DataTable';
import ImportExportBar from '@/components/ImportExportBar';
import { useLocale } from '@/components/LocaleContext';

const TYPES = ['ADD', 'REMOVE', 'ADJUST', 'TRANSFER'];

export default function MovementsPage() {
  const { t, locale } = useLocale();
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
      setError(err.message || t('movements.loadFailed'));
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
    { key: 'occurredAt', header: t('movements.colWhen'), sortable: true, render: (m) => formatDateTime(m.occurredAt || m.createdAt, locale) },
    {
      key: 'item',
      header: t('movements.colItem'),
      render: (m) => (
        <Link href={`/items/${m.item?.id || m.itemId}`} className="hover:text-brand-300">
          {m.item?.name || m.itemName} <span className="text-xs text-base-100/40">({m.item?.sku || m.itemSku})</span>
        </Link>
      ),
    },
    { key: 'type', header: t('movements.colType'), render: (m) => movementLabel(m.type, locale) },
    {
      key: 'room',
      header: t('movements.colRooms'),
      render: (m) =>
        m.type === 'TRANSFER'
          ? `${roomShortName(m.fromRoom?.code || m.fromRoomCode, locale)} → ${roomShortName(m.toRoom?.code || m.toRoomCode, locale)}`
          : roomShortName(m.toRoom?.code || m.fromRoom?.code || m.roomCode, locale),
    },
    { key: 'quantity', header: t('movements.colQty'), align: 'right', render: (m) => formatNumber(m.quantity, locale) },
    { key: 'user', header: t('movements.colBy'), render: (m) => m.user?.name || m.userName || '—' },
    { key: 'note', header: t('movements.colNote'), render: (m) => m.note || '—' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">{t('movements.title')}</h1>
          <p className="mt-1 text-sm text-base-100/50">
            {t('movements.subtitle')}
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
        emptyMessage={t('movements.empty')}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <select className="input-field w-auto py-1.5 text-xs" value={itemFilter} onChange={(e) => setItemFilter(e.target.value)}>
              <option value="">{t('movements.allItems')}</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </select>
            <select className="input-field w-auto py-1.5 text-xs" value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
              <option value="">{t('movements.allRooms')}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {roomShortName(r.code, locale)}
                </option>
              ))}
            </select>
            <select className="input-field w-auto py-1.5 text-xs" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">{t('movements.allTypes')}</option>
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {movementLabel(type, locale)}
                </option>
              ))}
            </select>
          </div>
        }
      />
    </div>
  );
}
