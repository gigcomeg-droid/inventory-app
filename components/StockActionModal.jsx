'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import apiClient from '@/lib/apiClient';
import { roomDisplayName } from '@/lib/formatters';
import { useLocale } from '@/components/LocaleContext';

const ENDPOINTS = {
  add: '/stock/add',
  remove: '/stock/remove',
  adjust: '/stock/adjust',
  transfer: '/stock/transfer',
};

/**
 * Unified modal for the four stock operations. `action` is one of
 * 'add' | 'remove' | 'adjust' | 'transfer'.
 *
 * - item: { id, name, sku, perRoom? } — the item being acted on.
 * - roomId: the room this action is scoped to (source room for
 *   remove/adjust/transfer, destination room for add).
 * - rooms: full room list (used to build the "to room" selector for
 *   transfer, excluding `roomId`).
 * - currentQuantity: current quantity in `roomId` (for adjust/remove display).
 */
export default function StockActionModal({
  open,
  onClose,
  action = 'add',
  item,
  roomId,
  rooms = [],
  currentQuantity,
  onSaved,
}) {
  const { t, locale } = useLocale();
  const TITLES = {
    add: t('stockAction.add'),
    remove: t('stockAction.remove'),
    adjust: t('stockAction.adjust'),
    transfer: t('stockAction.transfer'),
  };
  const [quantity, setQuantity] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [toRoomId, setToRoomId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuantity('');
    setNewQuantity(currentQuantity ?? '');
    setNote('');
    setError('');
    const otherRooms = rooms.filter((r) => r.id !== roomId);
    setToRoomId(otherRooms[0]?.id || '');
  }, [open, action, roomId, currentQuantity, rooms]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!item?.id || !roomId) {
      setError(t('stockAction.missingContext'));
      return;
    }

    let payload;
    if (action === 'adjust') {
      if (newQuantity === '' || Number(newQuantity) < 0) {
        setError(t('stockAction.invalidQuantity'));
        return;
      }
      payload = { itemId: item.id, roomId, newQuantity: Number(newQuantity), note: note.trim() || undefined };
    } else if (action === 'transfer') {
      if (!toRoomId) {
        setError(t('stockAction.chooseDestination'));
        return;
      }
      if (toRoomId === roomId) {
        setError(t('stockAction.sameRoom'));
        return;
      }
      if (!quantity || Number(quantity) <= 0) {
        setError(t('stockAction.quantityPositive'));
        return;
      }
      payload = {
        itemId: item.id,
        fromRoomId: roomId,
        toRoomId,
        quantity: Number(quantity),
        note: note.trim() || undefined,
      };
    } else {
      if (!quantity || Number(quantity) <= 0) {
        setError(t('stockAction.quantityPositive'));
        return;
      }
      payload = { itemId: item.id, roomId, quantity: Number(quantity), note: note.trim() || undefined };
    }

    setSaving(true);
    try {
      const result = await apiClient.post(ENDPOINTS[action], payload);
      onSaved?.(result);
      onClose?.();
    } catch (err) {
      setError(err.message || t('stockAction.failed'));
    } finally {
      setSaving(false);
    }
  }

  const otherRooms = rooms.filter((r) => r.id !== roomId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={TITLES[action] || t('stockAction.generic')}
      subtitle={item ? `${item.name} · ${item.sku}` : undefined}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {typeof currentQuantity === 'number' && (
          <p className="text-sm text-base-100/60">
            {t('stockAction.currentQuantity')}{' '}
            <span className="font-semibold text-base-100">{currentQuantity}</span>
          </p>
        )}

        {action === 'adjust' ? (
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('stockAction.newQuantity')}</span>
            <input
              type="number"
              min="0"
              autoFocus
              className="input-field"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
            />
          </label>
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('stockAction.quantity')}</span>
            <input
              type="number"
              min="1"
              autoFocus
              className="input-field"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
          </label>
        )}

        {action === 'transfer' && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('stockAction.transferTo')}</span>
            <select className="input-field" value={toRoomId} onChange={(e) => setToRoomId(e.target.value)}>
              {otherRooms.length === 0 && <option value="">{t('stockAction.noOtherRooms')}</option>}
              {otherRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {roomDisplayName(r.code, locale)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('stockAction.note')}</span>
          <textarea
            className="input-field min-h-[60px] resize-y"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('stockAction.notePlaceholder')}
          />
        </label>

        {error && (
          <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-3 py-2 text-sm text-accent-rose">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('stockAction.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? t('stockAction.saving') : TITLES[action]}
          </button>
        </div>
      </form>
    </Modal>
  );
}
