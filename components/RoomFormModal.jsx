'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import apiClient from '@/lib/apiClient';

const emptyForm = {
  code: '',
  name: '',
  location: '',
  description: '',
  sortOrder: '',
};

/**
 * Add / edit storage room modal. ADMIN only (the pages that render this
 * are already gated with RoleGate, and the API routes enforce it server-side
 * too).
 * - `room`: existing room to edit, or null/undefined to create a new room.
 */
export default function RoomFormModal({ open, onClose, room, onSaved }) {
  const isEdit = Boolean(room?.id);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm({
      code: room?.code || '',
      name: room?.name || '',
      location: room?.location || '',
      description: room?.description || '',
      sortOrder: room?.sortOrder ?? '',
    });
  }, [open, room]);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!isEdit && !form.code.trim()) {
      setError('Room code is required (e.g. ROOM5).');
      return;
    }
    if (!form.name.trim()) {
      setError('Room name is required.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      location: form.location.trim() || null,
      description: form.description.trim() || null,
      sortOrder: form.sortOrder === '' ? undefined : Number(form.sortOrder),
    };
    if (!isEdit) payload.code = form.code.trim();

    setSaving(true);
    try {
      const saved = isEdit
        ? await apiClient.put(`/rooms/${room.id}`, payload)
        : await apiClient.post('/rooms', payload);
      onSaved?.(saved);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Failed to save room.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Storage Room' : 'Add New Storage Room'}
      subtitle={isEdit ? form.code : 'Rooms are kept fully separate — stock is never mixed between them.'}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Room Code" required={!isEdit}>
          <input
            className="input-field font-mono uppercase"
            value={form.code}
            onChange={(e) => updateField('code', e.target.value)}
            placeholder="e.g. ROOM5"
            disabled={isEdit}
          />
          {isEdit && (
            <p className="mt-1 text-[11px] text-base-100/40">
              Room codes can't be changed after creation — they're used in URLs and movement history.
            </p>
          )}
        </Field>

        <Field label="Room Name" required>
          <input
            className="input-field"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g. Storage Room 5 — Cold Storage"
          />
        </Field>

        <Field label="Location (optional)">
          <input
            className="input-field"
            value={form.location}
            onChange={(e) => updateField('location', e.target.value)}
            placeholder="e.g. Building C, Ground Floor"
          />
        </Field>

        <Field label="Description (optional)">
          <textarea
            className="input-field min-h-[70px] resize-y"
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
          />
        </Field>

        <Field label="Sort Order (optional)">
          <input
            type="number"
            className="input-field"
            value={form.sortOrder}
            onChange={(e) => updateField('sortOrder', e.target.value)}
            placeholder="Controls ordering in the sidebar"
          />
        </Field>

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
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Room'}
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
