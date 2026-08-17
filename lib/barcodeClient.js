// Client-side barcode / QR rendering. Pure local, no network.
// Wraps `jsbarcode` (CODE128) and `qrcode` (canvas renderer).

import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

/**
 * Render a CODE128 barcode onto a <canvas> element.
 * @param {HTMLCanvasElement} canvasEl
 * @param {string} value
 * @param {object} [options] optional JsBarcode overrides
 */
export function renderBarcode(canvasEl, value, options = {}) {
  if (!canvasEl || !value) return;
  try {
    JsBarcode(canvasEl, String(value), {
      format: 'CODE128',
      width: 2,
      height: 60,
      displayValue: true,
      background: '#ffffff',
      lineColor: '#0b0f19',
      margin: 8,
      fontSize: 14,
      ...options,
    });
  } catch (err) {
    // Invalid characters for barcode encoding, etc. — fail quietly, caller
    // can show a fallback message.
    console.error('renderBarcode failed:', err);
    throw err;
  }
}

/**
 * Render a QR code onto a <canvas> element.
 * @param {HTMLCanvasElement} canvasEl
 * @param {string} value
 * @param {object} [options] optional qrcode overrides
 */
export function renderQrCode(canvasEl, value, options = {}) {
  if (!canvasEl || !value) return Promise.resolve();
  return QRCode.toCanvas(canvasEl, String(value), {
    width: 180,
    margin: 2,
    color: {
      dark: '#0b0f19',
      light: '#ffffff',
    },
    ...options,
  });
}
