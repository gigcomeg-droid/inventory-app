'use client';

// Language/direction context. Each user's choice is stored in a plain
// (non-httpOnly) cookie so: (a) client code can read/write it instantly, and
// (b) the server root layout (app/layout.js) can read it on the next
// request to render <html lang dir> correctly from the very first paint —
// avoiding a flash of the wrong text direction.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { translate, SUPPORTED_LOCALES, RTL_LOCALES } from '@/lib/i18n/dictionary';

const LOCALE_COOKIE = 'locale';

const LocaleContext = createContext({
  locale: 'en',
  dir: 'ltr',
  t: (key) => key,
  setLocale: () => {},
});

function setCookie(name, value) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function LocaleProvider({ initialLocale, children }) {
  const [locale, setLocaleState] = useState(
    SUPPORTED_LOCALES.includes(initialLocale) ? initialLocale : 'en'
  );

  const setLocale = useCallback((next) => {
    if (!SUPPORTED_LOCALES.includes(next)) return;
    setLocaleState(next);
    setCookie(LOCALE_COOKIE, next);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', next);
      document.documentElement.setAttribute('dir', RTL_LOCALES.includes(next) ? 'rtl' : 'ltr');
    }
  }, []);

  const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
  const t = useCallback((key, params) => translate(locale, key, params), [locale]);
  const value = useMemo(() => ({ locale, dir, t, setLocale }), [locale, dir, t, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
