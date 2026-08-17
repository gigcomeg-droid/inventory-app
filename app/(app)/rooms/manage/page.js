'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/apiClient';
import { formatNumber, roomShortName } from '@/lib/formatters';
import DataTable from '@/components/DataTable';
import RoomFormModal from '@/components/RoomFormModal';
import RoleGate from '@/components/RoleGate';

export default function ManageRoomsPage() {
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
      setError(err.message || 'Failed to load storage rooms.');
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
          `Delete "${room.name}" (${room.code})? This can't be undone from the app. It will be refused if the room still holds any stock.`
        )
      ) {
        return;
      }
      setError('');
      try {
        await apiClient.delete(`/rooms/${room.id}`);
        loadRooms();
      } catch (err) {
        setError(err.message || 'Failed to delete room.');
      }
    },
    [loadRooms]
  );

  const columns = [
    { key: 'code', header: 'Code', className: 'font-mono text-xs' },
    {
      key: 'name',
      header: 'Name',
      render: (r) => (
        <Link href={`/rooms/${r.code}`} className="font-medium text-base-100 hover:text-brand-300">
          {r.name}
        </Link>
      ),
    },
    { key: 'location', header: 'Location', render: (r) => r.location || '—' },
    {
      key: 'itemCount',
      header: 'Items',
      align: 'right',
      render: (r) => formatNumber(r.itemCount),
    },
    {
      key: 'totalUnits',
      header: 'Total Units',
      align: 'right',
      render: (r) => formatNumber(r.totalUnits),
    },
    {
      key: 'lowStockCount',
      header: 'Low Stock',
      align: 'right',
      render: (r) =>
        r.lowStockCount > 0 ? (
          <span className="badge bg-accent-amber/15 text-accent-amber">{r.lowStockCount}</span>
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
            Edit
          </button>
          <button
            type="button"
            className="btn-ghost !px-2 !py-1 text-xs !text-accent-rose hover:!bg-accent-rose/10"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(r);
            }}
          >
            Delete
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
          You need Admin access to manage storage rooms.
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Manage Storage Rooms</h1>
            <p className="mt-1 text-sm text-base-100/50">
              Add, edit, or delete storage rooms. Each room's stock stays fully independent — adding a
              room here never merges or moves any existing inventory, and a room can't be deleted while
              it still holds stock.
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}>
            + Add Room
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
            {error}
          </div>
        )}

        <DataTable columns={columns} data={rooms} rowKey={(r) => r.id} loading={loading} emptyMessage="No storage rooms yet." />

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
