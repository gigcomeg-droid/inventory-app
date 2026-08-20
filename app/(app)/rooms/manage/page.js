'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/apiClient';
import { formatNumber, roomShortName } from '@/lib/formatters';
import DataTable from '@/components/DataTable';
import RoomFormModal from '@/components/RoomFormModal';
import RoleGate from '@/components/RoleGate';
import { useLocale } from '@/components/LocaleContext';

export default function ManageRoomsPage() {
  const { t, locale } = useLocale();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.get('/rooms');
      setRooms(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || t('manageRooms.loadFailed'));
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  function openAdd() {
    setEditingRoom(null);
    setModalOpen(true);
  }

  function openEdit(room) {
    setEditingRoom(room);
    setModalOpen(true);
  }

  const handleDelete = useCallback(
    async (room) => {
      if (
        !window.confirm(
          t('manageRooms.deleteConfirm', { name: room.name, code: room.code })
        )
      ) {
        return;
      }
      setError('');
      try {
        await apiClient.delete(`/rooms/${room.id}`);
        loadRooms();
      } catch (err) {
        setError(err.message || t('manageRooms.deleteFailed'));
      }
    },
    [loadRooms, t]
  );

  const columns = [
    { key: 'code', header: t('manageRooms.colCode'), className: 'font-mono text-xs' },
    {
      key: 'name',
      header: t('manageRooms.colName'),
      render: (r) => (
        <Link href={`/rooms/${r.code}`} className="font-medium text-base-100 hover:text-brand-300">
          {r.name}
        </Link>
      ),
    },
    { key: 'location', header: t('manageRooms.colLocation'), render: (r) => r.location || '—' },
    {
      key: 'itemCount',
      header: t('manageRooms.colItems'),
      align: 'right',
      render: (r) => formatNumber(r.itemCount, locale),
    },
    {
      key: 'totalUnits',
      header: t('manageRooms.colTotalUnits'),
      align: 'right',
      render: (r) => formatNumber(r.totalUnits, locale),
    },
    {
      key: 'lowStockCount',
      header: t('manageRooms.colLowStock'),
      align: 'right',
      render: (r) =>
        r.lowStockCount > 0 ? (
          <span className="badge bg-accent-amber/15 text-accent-amber">
            {formatNumber(r.lowStockCount, locale)}
          </span>
        ) : (
          <span className="text-base-100/30">0</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            className="btn-ghost !px-2 !py-1 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(r);
            }}
          >
            {t('manageRooms.edit')}
          </button>
          <button
            type="button"
            className="btn-ghost !px-2 !py-1 text-xs !text-accent-rose hover:!bg-accent-rose/10"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(r);
            }}
          >
            {t('manageRooms.delete')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <RoleGate
      min="ADMIN"
      fallback={
        <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
          {t('manageRooms.needAdmin')}
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">{t('manageRooms.title')}</h1>
            <p className="mt-1 text-sm text-base-100/50">{t('manageRooms.subtitle')}</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}>
            {t('manageRooms.addNew')}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
            {error}
          </div>
        )}

        <DataTable
          columns={columns}
          data={rooms}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage={t('manageRooms.empty')}
        />

        <RoomFormModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          room={editingRoom}
          onSaved={loadRooms}
        />
      </div>
    </RoleGate>
  );
}
