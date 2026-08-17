'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/apiClient';
import { formatNumber, formatDateTime, roomShortName, movementLabel } from '@/lib/formatters';
import BarcodeDisplay from '@/components/BarcodeDisplay';
import LowStockBadge from '@/components/LowStockBadge';
import ItemFormModal from '@/components/ItemFormModal';
import StockActionModal from '@/components/StockActionModal';
import RoleGate from '@/components/RoleGate';

export default function ItemDetailPage({ params }) {
  const { id } = params;
  const router = useRouter();
  const [item, setItem] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stockModal, setStockModal] = useState({ open: false, action: 'add', roomId: null, currentQuantity: undefined });

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`Delete "${item?.name}"? This deactivates the item and hides it from active views.`)) {
      return;
    }
    setDeleting(true);
    try {
      await apiClient.delete(`/items/${id}`);
      router.push('/items');
    } catch (err) {
      setError(err.message || 'Failed to delete item.');
      setDeleting(false);
    }
  }, [id, item, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.get(`/items/${id}`);
      setItem(data);
    } catch (err) {
      setError(err.message || 'Failed to load item.');
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    apiClient.get('/rooms').then(setRooms).catch(() => {});
  }, [load]);

  if (loading) {
    return <p className="text-sm text-base-100/40">Loading item…</p>;
  }

  if (error || !item) {
    return (
      <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
        {error || 'Item not found.'}
      </div>
    );
  }

  const perRoom = item.perRoom || [];
  const movements = item.movements || item.recentMovements || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/items" className="text-xs text-brand-300 hover:text-brand-200">
            ← Back to all items
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-white">{item.name}</h1>
          <p className="mt-1 text-sm text-base-100/50">
            SKU <span className="font-mono text-base-100/70">{item.sku}</span>
            {item.category && <> · {item.category.name || item.category}</>}
            {item.supplier && <> · {item.supplier.name || item.supplier}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <RoleGate min="STAFF">
            <button type="button" className="btn-secondary" onClick={() => setEditOpen(true)}>
              Edit Item
            </button>
          </RoleGate>
          <RoleGate min="MANAGER">
            <button
              type="button"
              className="btn-ghost !border-accent-rose/30 !text-accent-rose hover:!bg-accent-rose/10"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete Item'}
            </button>
          </RoleGate>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="panel p-5">
            <h3 className="mb-4 text-sm font-semibold text-white">Quantities by Room</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-xs uppercase tracking-wide text-base-100/40">
                    <th className="px-3 py-2 font-medium">Room</th>
                    <th className="px-3 py-2 text-right font-medium">Quantity</th>
                    <th className="px-3 py-2 text-right font-medium">Min Level</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <RoleGate min="STAFF">
                      <th className="px-3 py-2 text-right font-medium">Actions</th>
                    </RoleGate>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {perRoom.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-base-100/40">
                        No room stock recorded yet.
                      </td>
                    </tr>
                  )}
                  {perRoom.map((pr) => (
                    <tr key={pr.roomId}>
                      <td className="px-3 py-2.5">
                        <Link href={`/rooms/${pr.roomCode}`} className="hover:text-brand-300">
                          {roomShortName(pr.roomCode)}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {formatNumber(pr.quantity)} <span className="text-xs font-normal text-base-100/40">{item.unit}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-base-100/60">
                        {pr.minStockLevel ?? item.defaultMinStockLevel}
                      </td>
                      <td className="px-3 py-2.5">
                        <LowStockBadge quantity={pr.quantity} minStockLevel={pr.minStockLevel} isLowStock={pr.isLowStock} />
                      </td>
                      <RoleGate min="STAFF">
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            {['add', 'remove', 'adjust', 'transfer'].map((action) => (
                              <button
                                key={action}
                                type="button"
                                className="btn-ghost !px-2 !py-1 text-xs capitalize"
                                onClick={() =>
                                  setStockModal({
                                    open: true,
                                    action,
                                    roomId: pr.roomId,
                                    currentQuantity: pr.quantity,
                                  })
                                }
                              >
                                {action}
                              </button>
                            ))}
                          </div>
                        </td>
                      </RoleGate>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel p-5">
            <h3 className="mb-4 text-sm font-semibold text-white">Recent Movement History</h3>
            {movements.length === 0 ? (
              <p className="text-sm text-base-100/40">No movements recorded for this item yet.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {movements.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="text-base-100/90">
                        {movementLabel(m.type)}{' '}
                        <span className="text-base-100/50">
                          {m.type === 'TRANSFER'
                            ? `${roomShortName(m.fromRoom?.code || m.fromRoomCode)} → ${roomShortName(m.toRoom?.code || m.toRoomCode)}`
                            : roomShortName(m.toRoom?.code || m.fromRoom?.code || m.roomCode)}
                        </span>
                      </p>
                      {m.note && <p className="truncate text-xs text-base-100/40">{m.note}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-medium text-base-100">{formatNumber(m.quantity)}</p>
                      <p className="text-xs text-base-100/40">{formatDateTime(m.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel p-5">
            <h3 className="mb-4 text-sm font-semibold text-white">Barcode / QR</h3>
            <BarcodeDisplay value={item.barcode} sku={item.sku} />
          </div>

          <div className="panel p-5">
            <h3 className="mb-3 text-sm font-semibold text-white">Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-base-100/40">Unit</dt>
                <dd className="text-base-100/80">{item.unit}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-base-100/40">Default Min Level</dt>
                <dd className="text-base-100/80">{item.defaultMinStockLevel}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-base-100/40">Total (All Rooms)</dt>
                <dd className="text-base-100/80">{formatNumber(item.totalQuantity ?? perRoom.reduce((s, r) => s + r.quantity, 0))}</dd>
              </div>
              {item.notes && (
                <div>
                  <dt className="text-base-100/40">Notes</dt>
                  <dd className="mt-1 text-base-100/80">{item.notes}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      <ItemFormModal open={editOpen} onClose={() => setEditOpen(false)} item={item} onSaved={load} />

      <StockActionModal
        open={stockModal.open}
        onClose={() => setStockModal((s) => ({ ...s, open: false }))}
        action={stockModal.action}
        item={item}
        roomId={stockModal.roomId}
        rooms={rooms}
        currentQuantity={stockModal.currentQuantity}
        onSaved={load}
      />
    </div>
  );
}
