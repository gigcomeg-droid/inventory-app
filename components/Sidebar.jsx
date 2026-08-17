'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useAuth, roleAtLeast } from '@/components/AuthContext';
import { roleLabel, roomShortName } from '@/lib/formatters';
import apiClient from '@/lib/apiClient';

const NAV_ICONS = {
  dashboard: (
    <path d="M4 13h6V4H4v9zM14 20h6v-9h-6v9zM14 4v4h6V4h-6zM4 20h6v-4H4v4z" strokeWidth="1.6" strokeLinejoin="round" />
  ),
  rooms: (
    <path d="M4 21V9l8-5 8 5v12M9 21v-6h6v6" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
  ),
  items: (
    <path
      d="M4 7l8-4 8 4M4 7v10l8 4M4 7l8 4M20 7v10l-8 4M20 7l-8 4m0 0v10"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  ),
  movements: (
    <path d="M7 7h13M7 7l4-4M7 7l4 4M17 17H4M17 17l-4-4M17 17l-4 4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  ),
  alerts: (
    <path
      d="M12 3l9 16H3l9-16zM12 10v4M12 17h.01"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  suppliers: (
    <path d="M3 9l2-5h14l2 5M3 9v10a1 1 0 001 1h16a1 1 0 001-1V9M3 9h18M9 13h6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  ),
  categories: (
    <path d="M4 4h7v7H4V4zM13 4h7v7h-7V4zM4 13h7v7H4v-7zM13 13h7v7h-7v-7z" strokeWidth="1.6" strokeLinejoin="round" />
  ),
  users: (
    <path
      d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  logout: (
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  ),
};

function Icon({ name, className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      {NAV_ICONS[name]}
    </svg>
  );
}

// Shown briefly before the real room list loads from /api/rooms, so the
// sidebar isn't empty on first paint. Once rooms load, this is replaced by
// the live list — which reflects any rooms an Admin has added beyond the
// original 4.
const FALLBACK_ROOM_LINKS = [
  { code: 'ROOM1', label: 'Room 1' },
  { code: 'ROOM2', label: 'Room 2' },
  { code: 'ROOM3', label: 'Room 3' },
  { code: 'ROOM4', label: 'Room 4' },
];

export default function Sidebar({ mobileOpen, onCloseMobile }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [rooms, setRooms] = useState(null);

  useEffect(() => {
    if (!user) return;
    apiClient
      .get('/rooms')
      .then((data) => setRooms(Array.isArray(data) ? data : []))
      .catch(() => setRooms([]));
  }, [user]);

  const roomLinks = rooms
    ? rooms.map((r) => ({ code: r.code, label: roomShortName(r.code) || r.name }))
    : FALLBACK_ROOM_LINKS;

  const navSections = [
    {
      items: [{ href: '/dashboard', label: 'Dashboard', icon: 'dashboard' }],
    },
    {
      title: 'Storage Rooms',
      items: roomLinks.map((r) => ({ href: `/rooms/${r.code}`, label: r.label, icon: 'rooms' })),
    },
    {
      title: 'Inventory',
      items: [
        { href: '/items', label: 'All Items', icon: 'items' },
        { href: '/movements', label: 'Movements', icon: 'movements' },
        { href: '/alerts', label: 'Alerts', icon: 'alerts' },
      ],
    },
    {
      title: 'Catalog',
      items: [
        { href: '/suppliers', label: 'Suppliers', icon: 'suppliers' },
        { href: '/categories', label: 'Categories', icon: 'categories' },
      ],
    },
  ];

  const isActive = (href) => pathname === href || (href !== '/dashboard' && pathname?.startsWith(href));

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-500/15">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Company logo" className="h-full w-full object-cover" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-white">Inventory Ops</p>
          <p className="text-[11px] leading-tight text-base-100/40">Local Ops Center</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {navSections.map((section, si) => (
          <div key={si}>
            {section.title && (
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-base-100/30">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={clsx(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition',
                    isActive(item.href)
                      ? 'bg-brand-500/15 text-brand-200 shadow-glow'
                      : 'text-base-100/60 hover:bg-white/5 hover:text-base-100'
                  )}
                >
                  <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {roleAtLeast(user?.role, 'ADMIN') && (
          <div>
            <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-base-100/30">
              Administration
            </p>
            <div className="space-y-0.5">
              <Link
                href="/rooms/manage"
                onClick={onCloseMobile}
                className={clsx(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition',
                  isActive('/rooms/manage')
                    ? 'bg-brand-500/15 text-brand-200 shadow-glow'
                    : 'text-base-100/60 hover:bg-white/5 hover:text-base-100'
                )}
              >
                <Icon name="rooms" className="h-4 w-4 shrink-0" />
                <span>Manage Rooms</span>
              </Link>
              <Link
                href="/users"
                onClick={onCloseMobile}
                className={clsx(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition',
                  isActive('/users')
                    ? 'bg-brand-500/15 text-brand-200 shadow-glow'
                    : 'text-base-100/60 hover:bg-white/5 hover:text-base-100'
                )}
              >
                <Icon name="users" className="h-4 w-4 shrink-0" />
                <span>Users</span>
              </Link>
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-white/5 p-3">
        {user ? (
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-semibold text-brand-200">
              {user.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-base-100">{user.name}</p>
              <p className="truncate text-[11px] text-base-100/40">{roleLabel(user.role)}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg p-1.5 text-base-100/40 transition hover:bg-white/5 hover:text-accent-rose"
              aria-label="Log out"
              title="Log out"
            >
              <Icon name="logout" className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="h-10 animate-pulse rounded-lg bg-white/5" />
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-white/5 bg-base-900/80 backdrop-blur-sm lg:block">
        <div className="fixed h-screen w-64">{content}</div>
      </aside>

      {/* Mobile / tablet: drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-base-950/70 backdrop-blur-sm" onClick={onCloseMobile} />
          <div className="relative h-full w-72 bg-base-900 shadow-2xl">{content}</div>
        </div>
      )}
    </>
  );
}
