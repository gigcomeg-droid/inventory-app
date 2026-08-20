'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/apiClient';
import { useLocale } from '@/components/LocaleContext';
import LanguageToggle from '@/components/LanguageToggle';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError(t('auth.bothRequired'));
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/login', { username: username.trim(), password });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err.message || t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-center">
          <LanguageToggle />
        </div>

        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-brand-500/15 shadow-glow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Company logo" className="h-full w-full object-cover" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">{t('app.name')}</h1>
            <p className="mt-1 text-sm text-base-100/60">{t('app.tagline')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="panel-glow space-y-4 p-6">
          <div>
            <label htmlFor="username" className="mb-1.5 block text-xs font-medium text-base-100/70">
              {t('auth.username')}
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('auth.usernamePlaceholder')}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-base-100/70">
              {t('auth.password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-3 py-2 text-sm text-accent-rose">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </form>
      </div>
    </main>
  );
}
