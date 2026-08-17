'use client';

import { Fragment, useMemo, useState } from 'react';
import clsx from 'clsx';

function getValue(row, key) {
  return key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), row);
}

/**
 * Generic sortable / searchable data table.
 *
 * Props:
 * - columns: [{ key, header, sortable?, render?(row), align?, className? }]
 * - data: array of row objects
 * - rowKey: (row) => string|number
 * - searchable: boolean — show a built-in search box, filters across `searchKeys`
 * - searchKeys: string[] — dotted paths to search over (defaults to all column keys)
 * - toolbar: extra node rendered next to the search box
 * - emptyMessage: string
 * - loading: boolean
 * - error: string
 * - onRowClick: (row) => void
 * - expandedRowRender: (row) => node — if provided, rows become expandable
 */
export default function DataTable({
  columns,
  data = [],
  rowKey = (row, i) => row?.id ?? i,
  searchable = false,
  searchKeys,
  toolbar,
  emptyMessage = 'No records found.',
  loading = false,
  error = '',
  onRowClick,
  expandedRowRender,
  dense = false,
}) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [expandedKey, setExpandedKey] = useState(null);

  const effectiveSearchKeys = searchKeys || columns.map((c) => c.key);

  const filtered = useMemo(() => {
    if (!searchable || !search.trim()) return data;
    const q = search.trim().toLowerCase();
    return data.filter((row) =>
      effectiveSearchKeys.some((key) => {
        const val = getValue(row, key);
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, searchable, effectiveSearchKeys]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = getValue(a, sortKey);
      const bv = getValue(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return -1;
      if (bv == null) return 1;
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv), undefined, { numeric: true });
    });
    if (sortDir === 'desc') copy.reverse();
    return copy;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir('asc');
    }
  }

  return (
    <div className="panel overflow-hidden">
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-white/5 p-4">
          {searchable && (
            <div className="relative w-full max-w-xs">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-100/40"
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
                placeholder="Search…"
                className="input-field pl-9"
              />
            </div>
          )}
          {toolbar && <div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 text-xs uppercase tracking-wide text-base-100/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'whitespace-nowrap px-4 py-3 font-medium',
                    col.align === 'right' && 'text-right',
                    col.sortable && 'cursor-pointer select-none hover:text-base-100/70'
                  )}
                  onClick={() => col.sortable && toggleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <span className="text-brand-400">{sortDir === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-base-100/40">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-accent-rose">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-base-100/40">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              sorted.map((row, i) => {
                const key = rowKey(row, i);
                const isExpanded = expandedKey === key;
                return (
                  <Fragment key={key}>
                    <tr
                      onClick={() => {
                        if (expandedRowRender) setExpandedKey(isExpanded ? null : key);
                        if (onRowClick) onRowClick(row);
                      }}
                      className={clsx(
                        'transition hover:bg-white/[0.03]',
                        (onRowClick || expandedRowRender) && 'cursor-pointer',
                        dense ? 'text-sm' : ''
                      )}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={clsx(
                            'px-4 py-3 align-middle text-base-100/90',
                            col.align === 'right' && 'text-right',
                            col.className
                          )}
                        >
                          {col.render ? col.render(row) : getValue(row, col.key)}
                        </td>
                      ))}
                    </tr>
                    {expandedRowRender && isExpanded && (
                      <tr className="bg-white/[0.02]">
                        <td colSpan={columns.length} className="px-4 py-3">
                          {expandedRowRender(row)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
