// Small formatting helpers shared across the frontend.

export const ROOM_NAMES = {
  ROOM1: 'Storage Room 1',
  ROOM2: 'Storage Room 2',
  ROOM3: 'Storage Room 3',
  ROOM4: 'Storage Room 4',
};

export function roomDisplayName(code) {
  if (!code) return 'Unknown Room';
  return ROOM_NAMES[code] || code;
}

export function roomShortName(code) {
  if (!code) return '—';
  const match = /^ROOM(\d+)$/.exec(code);
  return match ? `Room ${match[1]}` : code;
}

export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(d);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatRelativeTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = d.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const divisions = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, secs] of divisions) {
    if (Math.abs(diffSec) >= secs || unit === 'second') {
      return rtf.format(Math.round(diffSec / secs), unit);
    }
  }
  return formatDateTime(value);
}

export function movementLabel(type) {
  switch (type) {
    case 'ADD':
      return 'Stock Added';
    case 'REMOVE':
      return 'Stock Removed';
    case 'ADJUST':
      return 'Stock Adjusted';
    case 'TRANSFER':
      return 'Transferred';
    default:
      return type || 'Movement';
  }
}

export function roleLabel(role) {
  if (!role) return '—';
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export function titleCase(value) {
  if (!value) return '';
  return String(value)
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}
