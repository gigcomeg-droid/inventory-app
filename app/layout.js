import './globals.css';

// NOTE: intentionally not using next/font/google here — this project must
// build and run with zero external network access. We rely on the
// system-font stack defined in tailwind.config.js (`font-sans`) instead.

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
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-base-950 bg-grid-glow font-sans text-base-100">
        {children}
      </body>
    </html>
  );
}
