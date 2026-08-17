'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import apiClient from '@/lib/apiClient';
import { roomShortName } from '@/lib/formatters';

const emptyForm = {
  name: '',
  sku: '',
  barcode: '',
  unit: 'pcs',
  categoryId: '',
  supplierId: '',
  defaultMinStockLevel: 0,
  notes: '',
  photoUrl: '',
};

/**
 * Add / edit item modal.
 * - `item`: existing item to edit, or null/undefined to create a new item.
 * - `defaultRoomId`: when creating from a room page, preselects that room's
 *   initial-stock field so the "add item" flow is one step.
 */
export default function ItemFormModal({ open, onClose, item, defaultRoomId, onSaved }) {
  const isEdit = Boolean(item?.id);
  const [form, setForm] = useState(emptyForm);
  const [rooms, setRooms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [initialStock, setInitialStock] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm({
      name: item?.name || '',
      sku: item?.sku || '',
      barcode: item?.barcode || '',
      unit: item?.unit || 'pcs',
      categoryId: item?.categoryId || item?.category?.id || '',
      supplierId: item?.supplierId || item?.supplier?.id || '',
      defaultMinStockLevel: item?.defaultMinStockLevel ?? 0,
      notes: item?.notes || '',
      photoUrl: item?.photoUrl || '',
    });
    setInitialStock(defaultRoomId ? { [defaultRoomId]: '' } : {});

    (async () => {
      try {
        const [roomsRes, categoriesRes, suppliersRes] = await Promise.allSettled([
          apiClient.get('/rooms'),
          apiClient.get('/categories'),
          apiClient.get('/suppliers'),
        ]);
        if (roomsRes.status === 'fulfilled') setRooms(roomsRes.value || []);
        if (categoriesRes.status === 'fulfilled') setCategories(categoriesRes.value || []);
        if (suppliersRes.status === 'fulfilled') setSuppliers(suppliersRes.value || []);
      } catch (_) {
        // handled per-request above
      }
    })();
  }, [open, item, defaultRoomId]);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.sku.trim()) {
      setError('Name and SKU are required.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim() || null,
      unit: form.unit.trim() || 'pcs',
      categoryId: form.categoryId || null,
      supplierId: form.supplierId || null,
      defaultMinStockLevel: Number(form.defaultMinStockLevel) || 0,
      notes: form.notes.trim() || null,
      photoUrl: form.photoUrl.trim() || null,
    };

    if (!isEdit) {
      const stockEntries = Object.entries(initialStock)
        .filter(([, qty]) => qty !== '' && qty !== null && Number(qty) > 0)
        .map(([roomId, qty]) => ({ roomId, quantity: Number(qty) }));
      if (stockEntries.length > 0) payload.initialStock = stockEntries;
    }

    setSaving(true);
    try {
      const saved = isEdit
        ? await apiClient.put(`/items/${item.id}`, payload)
        : await apiClient.post('/items', payload);
      onSaved?.(saved);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Failed to save item.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Item' : 'Add New Item'}
      subtitle={isEdit ? form.sku : 'Create a catalog item, optionally seed starting stock.'}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. Wireless Mouse"
            />
          </Field>
          <Field label="SKU" required>
            <input
              className="input-field font-mono"
              value={form.sku}
              onChange={(e) => updateField('sku', e.target.value)}
              placeholder="e.g. WM-1001"
              disabled={isEdit}
            />
          </Field>
          <Field label="Barcode (optional)">
            <input
              className="input-field font-mono"
              value={form.barcode}
              onChange={(e) => updateField('barcode', e.target.value)}
              placeholder="defaults to SKU"
            />
          </Field>
          <Field label="Unit">
            <input
              className="input-field"
              value={form.unit}
              onChange={(e) => updateField('unit', e.target.value)}
              placeholder="pcs, box, kg…"
            />
          </Field>
          <Field label="Category">
            <select
              className="input-field"
              value={form.categoryId}
              onChange={(e) => updateField('categoryId', e.target.value)}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Supplier">
            <select
              className="input-field"
              value={form.supplierId}
              onChange={(e) => updateField('supplierId', e.target.value)}
            >
              <option value="">No supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Default Min Stock Level">
            <input
              type="number"
              min="0"
              className="input-field"
              value={form.defaultMinStockLevel}
              onChange={(e) => updateField('defaultMinStockLevel', e.target.value)}
            />
          </Field>
          <Field label="Photo URL (optional)">
            <input
              className="input-field"
              value={form.photoUrl}
              onChange={(e) => updateField('photoUrl', e.target.value)}
              placeholder="https://…"
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            className="input-field min-h-[70px] resize-y"
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
          />
        </Field>

        {!isEdit && rooms.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-base-100/70">
              Starting stock (optional — leave blank for 0)
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {rooms.map((r) => (
                <Field key={r.id} label={roomShortName(r.code)}>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={initialStock[r.id] ?? ''}
                    onChange={(e) =>
                      setInitialStock((prev) => ({ ...prev, [r.id]: e.target.value }))
                    }
                    placeholder="0"
                  />
                </Field>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-3 py-2 text-sm text-accent-rose">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Item'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-base-100/70">
        {label} {required && <span className="text-accent-rose">*</span>}
      </span>
      {children}
    </label>
  );
}
