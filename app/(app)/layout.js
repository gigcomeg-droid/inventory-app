'use client';

import { useState } from 'react';
import { AuthProvider, useAuth } from '@/components/AuthContext';
import Sidebar from '@/components/Sidebar';
import AssistantPanel from '@/components/AssistantPanel';

function AppShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading, error } = useAuth();

  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/5 bg-base-950/80 px-4 py-3 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-base-100/70 transition hover:bg-white/5 hover:text-base-100"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <p className="text-sm font-semibold text-white">Inventory Ops</p>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/20 text-xs font-semibold text-brand-200">
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {loading ? (
            <div className="flex h-[60vh] items-center justify-center">
              <p className="text-sm text-base-100/40">Loading…</p>
            </div>
          ) : !user ? (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm text-base-100/60">
                {error || 'You need to sign in to view this page.'}
              </p>
              <a href="/login" className="btn-primary mt-2">
                Go to Login
              </a>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {user && <AssistantPanel />}
    </div>
  );
}

export default function AppLayout({ children }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
