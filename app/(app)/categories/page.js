'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/lib/apiClient';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import RoleGate from '@/components/RoleGate';
import { useLocale } from '@/components/LocaleContext';

const emptyForm = { name: '', description: '' };

export default function CategoriesPage() {
  const { t, locale } = useLocale();
  const [categories, setCategories] = useState([]);
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
      const data = await apiClient.get('/categories');
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || t('categories.loadFailed'));
      setCategories([]);
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

  function openEdit(category) {
    setEditing(category);
    setForm({ name: category.name || '', description: category.description || '' });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError(t('categories.nameRequired'));
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await apiClient.put(`/categories/${editing.id}`, form);
      } else {
        await apiClient.post('/categories', form);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || t('categories.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category) {
    if (!window.confirm(t('categories.deleteConfirm', { name: category.name }))) return;
    try {
      await apiClient.delete(`/categories/${category.id}`);
      await load();
    } catch (err) {
      setError(err.message || t('categories.deleteFailed'));
    }
  }

  const columns = [
    { key: 'name', header: t('categories.colName'), sortable: true },
    { key: 'description', header: t('categories.colDescription'), render: (r) => r.description || '—' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <RoleGate min="MANAGER">
          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openEdit(r)}>
              {t('categories.edit')}
            </button>
            <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-accent-rose" onClick={() => handleDelete(r)}>
              {t('categories.delete')}
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
          <h1 className="text-xl font-semibold tracking-tight text-white">{t('categories.title')}</h1>
          <p className="mt-1 text-sm text-base-100/50">{t('categories.subtitle')}</p>
        </div>
        <RoleGate min="MANAGER">
          <button type="button" className="btn-primary" onClick={openCreate}>
            {t('categories.addNew')}
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
        data={categories}
        rowKey={(r) => r.id}
        loading={loading}
        searchable
        searchKeys={['name', 'description']}
        emptyMessage={t('categories.empty')}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('categories.editTitle') : t('categories.addTitle')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('categories.name')} *</span>
            <input className="input-field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-base-100/70">{t('categories.description')}</span>
            <textarea
              className="input-field min-h-[70px] resize-y"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
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
              {saving ? t('categories.saving') : editing ? t('categories.saveChanges') : t('categories.createCategory')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
