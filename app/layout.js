import './globals.css';
import { cookies } from 'next/headers';
import { LocaleProvider } from '@/components/LocaleContext';
import { SUPPORTED_LOCALES, RTL_LOCALES } from '@/lib/i18n/dictionary';

// NOTE: intentionally not using next/font/google here — this project must
// build and run with zero external network access. We rely on the
// system-font stack defined in tailwind.config.js (`font-sans`) instead —
// modern system UI fonts (Segoe UI, San Francisco, etc.) render Arabic
// script fine without a webfont.

export const metadata = {
  title: 'Inventory Ops — Local Inventory Management',
  description:
    'Local-only, multi-room inventory management dashboard. Track stock across storage rooms, monitor low-stock alerts, and manage suppliers and categories.',
};

export const viewport = {
  themeColor: '#05070d',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  // Read the language cookie server-side so <html lang dir> is correct on
  // the very first byte sent — this avoids a flash of left-to-right layout
  // before client JS loads for users who've chosen Arabic.
  const cookieLocale = cookies().get('locale')?.value;
  const locale = SUPPORTED_LOCALES.includes(cookieLocale) ? cookieLocale : 'en';
  const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className="dark">
      <body className="min-h-screen bg-base-950 bg-grid-glow font-sans text-base-100">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
