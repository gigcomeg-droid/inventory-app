'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/lib/apiClient';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import RoleGate from '@/components/RoleGate';

const emptyForm = { name: '', description: '' };

export default function CategoriesPage() {
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
      setError(err.message || 'Failed to load categories.');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
      setFormError('Category name is required.');
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
      setFormError(err.message || 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category) {
    if (!window.confirm(`Delete category "${category.name}"?`)) return;
    try {
      await apiClient.delete(`/categories/${category.id}`);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to delete category.');
    }
  }

  const columns = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'description', header: 'Description', render: (r) => r.description || '—' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <RoleGate min="MANAGER">
          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openEdit(r)}>
              Edit
            </button>
            <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-accent-rose" onClick={() => handleDelete(r)}>
              Delete
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
          <h1 className="text-xl font-semibold tracking-tight text-white">Categories</h1>
          <p className="mt-1 text-sm text-base-100/50">Organize catalog items by category.</p>
        </div>
        <RoleGate min="MANAGER">
          <button type="button" className="btn-primary" onClick={openCreate}>
            + Add Category
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
        emptyMessage="No categories yet."
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Category' : 'Add Category'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-base-100/70">Name *</span>
            <input className="input-field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-base-100/70">Description</span>
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
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
