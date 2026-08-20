'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/apiClient';
import { formatNumber, roomShortName } from '@/lib/formatters';
import DataTable from '@/components/DataTable';
import LowStockBadge from '@/components/LowStockBadge';
import ImportExportBar from '@/components/ImportExportBar';
import ItemFormModal from '@/components/ItemFormModal';
import RoleGate from '@/components/RoleGate';
import { useLocale } from '@/components/LocaleContext';

export default function ItemsPage() {
  const { t, locale } = useLocale();
  const [items, setItems] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [itemModalOpen, setItemModalOpen] = useState(false);

  const loadItems = useCallback(async (filters = {}) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.category) params.set('category', filters.category);
      if (filters.supplier) params.set('supplier', filters.supplier);
      if (filters.lowStockOnly) params.set('lowStockOnly', 'true');
      const data = await apiClient.get(`/items?${params.toString()}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || t('items.loadFailed'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    apiClient.get('/rooms').then(setRooms).catch(() => {});
    apiClient.get('/categories').then(setCategories).catch(() => {});
    apiClient.get('/suppliers').then(setSuppliers).catch(() => {});
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      loadItems({ search, category: categoryFilter, supplier: supplierFilter, lowStockOnly });
    }, 300);
    return () => clearTimeout(handle);
  }, [search, categoryFilter, supplierFilter, lowStockOnly, loadItems]);

  function refresh() {
    loadItems({ search, category: categoryFilter, supplier: supplierFilter, lowStockOnly });
  }

  const handleDelete = useCallback(
    async (row) => {
      if (!window.confirm(t('items.deleteConfirm', { name: row.name }))) {
        return;
      }
      try {
        await apiClient.delete(`/items/${row.id}`);
        loadItems({ search, category: categoryFilter, supplier: supplierFilter, lowStockOnly });
      } catch (err) {
        setError(err.message || t('items.deleteFailed'));
      }
    },
    [loadItems, search, categoryFilter, supplierFilter, lowStockOnly, t]
  );

  const columns = [
    {
      key: 'name',
      header: t('items.colItem'),
      sortable: true,
      render: (r) => (
        <Link href={`/items/${r.id}`} className="font-medium text-base-100 hover:text-brand-300">
          {r.name}
        </Link>
      ),
    },
    { key: 'sku', header: t('items.colSku'), sortable: true, className: 'font-mono text-xs' },
    { key: 'category.name', header: t('items.colCategory'), sortable: true, render: (r) => r.category?.name || '—' },
    { key: 'supplier.name', header: t('items.colSupplier'), sortable: true, render: (r) => r.supplier?.name || '—' },
    {
      key: 'totalQuantity',
      header: t('items.colTotal'),
      sortable: true,
      align: 'right',
      render: (r) => (
        <span className="font-semibold text-base-100">
          {formatNumber(r.totalQuantity, locale)} <span className="text-xs font-normal text-base-100/40">{r.unit}</span>
        </span>
      ),
    },
    {
      key: 'lowStock',
      header: t('items.colStatus'),
      render: (r) => {
        const anyLow = (r.perRoom || []).some((pr) => pr.isLowStock);
        return anyLow ? (
          <LowStockBadge quantity={0} minStockLevel={0} isLowStock />
        ) : (
          <LowStockBadge quantity={1} minStockLevel={0} isLowStock={false} />
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <RoleGate min="MANAGER">
          <button
            type="button"
            title={t('items.deleteItemTitle')}
            className="btn-ghost !px-2 !py-1 text-xs !text-accent-rose hover:!bg-accent-rose/10"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(r);
            }}
          >
            {t('items.delete')}
          </button>
        </RoleGate>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">{t('items.title')}</h1>
          <p className="mt-1 text-sm text-base-100/50">
            {t('items.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RoleGate min="STAFF">
            <button type="button" className="btn-primary" onClick={() => setItemModalOpen(true)}>
              {t('items.addNew')}
            </button>
          </RoleGate>
        </div>
      </div>

      <ImportExportBar exportType="items" rooms={rooms} onImported={refresh} />

      {error && (
        <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={items}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage={t('items.empty')}
        expandedRowRender={(r) => <RoomBreakdown item={r} rooms={rooms} locale={locale} />}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-xs">
              <svg
                className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-base-100/40 ltr:left-3 rtl:right-3"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('items.searchPlaceholder')}
                className="input-field ltr:pl-9 rtl:pr-9"
              />
            </div>
            <select
              className="input-field w-auto py-1.5 text-xs"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">{t('items.allCategories')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="input-field w-auto py-1.5 text-xs"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              <option value="">{t('items.allSuppliers')}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-base-100/60">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/20 bg-base-950 text-brand-500 focus:ring-brand-500"
              />
              {t('items.lowStockOnly')}
            </label>
            <span className="text-xs text-base-100/30 ms-auto">{t('items.expandHint')}</span>
          </div>
        }
      />

      <ItemFormModal open={itemModalOpen} onClose={() => setItemModalOpen(false)} onSaved={refresh} />
    </div>
  );
}

function RoomBreakdown({ item, rooms, locale }) {
  const { t } = useLocale();
  const perRoom = item.perRoom || [];
  const byRoomId = useMemo(() => new Map(perRoom.map((pr) => [pr.roomId, pr])), [perRoom]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {(rooms.length > 0 ? rooms : perRoom).map((r) => {
        const pr = byRoomId.get(r.id) || byRoomId.get(r.roomId) || r;
        const code = r.code || pr.roomCode;
        return (
          <div key={r.id || r.roomId} className="rounded-lg border border-white/5 bg-base-950/40 px-3 py-2">
            <p className="text-xs font-medium text-base-100/50">{roomShortName(code, locale)}</p>
            <p className="mt-1 text-sm font-semibold text-base-100">
              {formatNumber(pr?.quantity ?? 0, locale)} <span className="text-xs font-normal text-base-100/40">{item.unit}</span>
            </p>
            {pr?.isLowStock && (
              <p className="mt-0.5 text-[11px] text-accent-amber">{t('items.lowLabel', { min: pr.minStockLevel })}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
