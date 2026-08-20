'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/lib/apiClient';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import RoleGate from '@/components/RoleGate';
import { useLocale } from '@/components/LocaleContext';

const emptyForm = { name: '', contactName: '', email: '', phone: '', address: '', notes: '' };

export default function SuppliersPage() {
  const { t, locale } = useLocale();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.get('/suppliers');
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || t('suppliers.loadFailed'));
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name || '',
      contactName: supplier.contactName || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError(t('suppliers.nameRequired'));
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await apiClient.put(`/suppliers/${editing.id}`, form);
      } else {
        await apiClient.post('/suppliers', form);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || t('suppliers.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(supplier) {
    if (!window.confirm(t('suppliers.deleteConfirm', { name: supplier.name }))) return;
    try {
      await apiClient.delete(`/suppliers/${supplier.id}`);
      await load();
    } catch (err) {
      setError(err.message || t('suppliers.deleteFailed'));
    }
  }

  const columns = [
    { key: 'name', header: t('suppliers.colName'), sortable: true },
    { key: 'contactName', header: t('suppliers.colContact'), sortable: true, render: (r) => r.contactName || '—' },
    { key: 'email', header: t('suppliers.colEmail'), render: (r) => r.email || '—' },
    { key: 'phone', header: t('suppliers.colPhone'), render: (r) => r.phone || '—' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <RoleGate min="MANAGER">
          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openEdit(r)}>
              {t('suppliers.edit')}
            </button>
            <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-accent-rose" onClick={() => handleDelete(r)}>
              {t('suppliers.delete')}
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
          <h1 className="text-xl font-semibold tracking-tight text-white">{t('suppliers.title')}</h1>
          <p className="mt-1 text-sm text-base-100/50">{t('suppliers.subtitle')}</p>
        </div>
        <RoleGate min="MANAGER">
          <button type="button" className="btn-primary" onClick={openCreate}>
            {t('suppliers.addNew')}
          </button>
        </RoleGate>
      </div>

      {error && (
        <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={suppliers}
        rowKey={(r) => r.id}
        loading={loading}
        searchable
        searchKeys={['name', 'contactName', 'email']}
        emptyMessage={t('suppliers.empty')}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('suppliers.editTitle') : t('suppliers.addTitle')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('suppliers.name')} *</span>
              <input className="input-field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('suppliers.contactName')}</span>
              <input
                className="input-field"
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('suppliers.email')}</span>
              <input
                type="email"
                className="input-field"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('suppliers.phone')}</span>
              <input className="input-field" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('suppliers.address')}</span>
            <input className="input-field" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('suppliers.notes')}</span>
            <textarea
              className="input-field min-h-[70px] resize-y"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>

          {formError && (
            <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-3 py-2 text-sm text-accent-rose">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('suppliers.saving') : editing ? t('suppliers.saveChanges') : t('suppliers.createSupplier')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
