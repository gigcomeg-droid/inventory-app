'use client';

import clsx from 'clsx';
import { useLocale } from '@/components/LocaleContext';

/** Small EN/AR pill switch — used in the sidebar and on the login page. */
export default function LanguageToggle({ className }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className={clsx('inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs', className)}>
      <button
        type="button"
        onClick={() => setLocale('en')}
        aria-pressed={locale === 'en'}
        className={clsx(
          'rounded-md px-2.5 py-1 font-medium transition',
          locale === 'en' ? 'bg-brand-500/20 text-brand-200' : 'text-base-100/50 hover:text-base-100'
        )}
      >
        {t('lang.english')}
      </button>
      <button
        type="button"
        onClick={() => setLocale('ar')}
        aria-pressed={locale === 'ar'}
        className={clsx(
          'rounded-md px-2.5 py-1 font-medium transition',
          locale === 'ar' ? 'bg-brand-500/20 text-brand-200' : 'text-base-100/50 hover:text-base-100'
        )}
      >
        {t('lang.arabic')}
      </button>
    </div>
  );
}
