'use client';

import { useEffect, useRef, useState } from 'react';
import { renderBarcode, renderQrCode } from '@/lib/barcodeClient';
import { useLocale } from '@/components/LocaleContext';

/**
 * Renders a CODE128 barcode or QR code for a given value, entirely
 * client-side (no network). Falls back to `sku` if `barcode` is not set.
 */
export default function BarcodeDisplay({ value, sku, label }) {
  const { t, locale } = useLocale();
  const [mode, setMode] = useState('barcode');
  const [error, setError] = useState('');
  const canvasRef = useRef(null);
  const encodedValue = value || sku;

  useEffect(() => {
    setError('');
    const canvas = canvasRef.current;
    if (!canvas || !encodedValue) return;

    if (mode === 'barcode') {
      try {
        renderBarcode(canvas, encodedValue);
      } catch (err) {
        setError(t('barcode.barcodeError'));
      }
    } else {
      renderQrCode(canvas, encodedValue).catch(() => {
        setError(t('barcode.qrError'));
      });
    }
  }, [mode, encodedValue]);

  if (!encodedValue) {
    return <p className="text-sm text-base-100/40">{t('barcode.notAvailable')}</p>;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-base-950/60 p-1 text-xs">
        <button
          type="button"
          onClick={() => setMode('barcode')}
          className={`rounded-md px-3 py-1.5 transition ${
            mode === 'barcode' ? 'bg-brand-500 text-white' : 'text-base-100/60 hover:text-base-100'
          }`}
        >
          {t('barcode.barcode')}
        </button>
        <button
          type="button"
          onClick={() => setMode('qr')}
          className={`rounded-md px-3 py-1.5 transition ${
            mode === 'qr' ? 'bg-brand-500 text-white' : 'text-base-100/60 hover:text-base-100'
          }`}
        >
          {t('barcode.qrCode')}
        </button>
      </div>

      <div className="rounded-xl bg-white p-3">
        <canvas ref={canvasRef} />
      </div>

      {label !== false && (
        <p className="text-xs text-base-100/40">
          {t('barcode.encodedValue')} <span className="font-mono text-base-100/70">{encodedValue}</span>
          {!value && sku && <span className="ml-1">{t('barcode.usingSku')}</span>}
        </p>
      )}

      {error && <p className="text-xs text-accent-rose">{error}</p>}
    </div>
  );
}
