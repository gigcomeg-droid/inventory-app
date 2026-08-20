'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import apiClient from '@/lib/apiClient';
import { useLocale } from '@/components/LocaleContext';

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
  const { t, locale } = useLocale();
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
      setError(t('roomForm.codeRequired'));
      return;
    }
    if (!form.name.trim()) {
      setError(t('roomForm.nameRequired'));
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
      setError(err.message || t('roomForm.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('roomForm.editTitle') : t('roomForm.addTitle')}
      subtitle={isEdit ? form.code : t('roomForm.addSubtitle')}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={t('roomForm.code')} required={!isEdit}>
          <input
            className="input-field font-mono uppercase"
            value={form.code}
            onChange={(e) => updateField('code', e.target.value)}
            placeholder={t('roomForm.codePlaceholder')}
            disabled={isEdit}
          />
          {isEdit && (
            <p className="mt-1 text-[11px] text-base-100/40">
              {t('roomForm.codeImmutable')}
            </p>
          )}
        </Field>

        <Field label={t('roomForm.name')} required>
          <input
            className="input-field"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder={t('roomForm.namePlaceholder')}
          />
        </Field>

        <Field label={t('roomForm.location')}>
          <input
            className="input-field"
            value={form.location}
            onChange={(e) => updateField('location', e.target.value)}
            placeholder={t('roomForm.locationPlaceholder')}
          />
        </Field>

        <Field label={t('roomForm.description')}>
          <textarea
            className="input-field min-h-[70px] resize-y"
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
          />
        </Field>

        <Field label={t('roomForm.sortOrder')}>
          <input
            type="number"
            step="1"
            className="input-field"
            value={form.sortOrder}
            onChange={(e) => updateField('sortOrder', e.target.value)}
            placeholder={t('roomForm.sortOrderPlaceholder')}
          />
        </Field>

        {error && (
          <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-3 py-2 text-sm text-accent-rose">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('roomForm.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? t('roomForm.saving') : isEdit ? t('roomForm.saveChanges') : t('roomForm.createRoom')}
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
