// Small formatting helpers shared across the frontend. Most accept an
// optional trailing `locale` ('en' | 'ar', defaults to 'en') so callers can
// pass the current useLocale().locale and get correctly-translated output
// without duplicating logic per page.

export const ROOM_NAMES = {
  ROOM1: 'Storage Room 1',
  ROOM2: 'Storage Room 2',
  ROOM3: 'Storage Room 3',
  ROOM4: 'Storage Room 4',
};

export function roomDisplayName(code, locale = 'en') {
  if (!code) return locale === 'ar' ? 'غرفة غير معروفة' : 'Unknown Room';
  if (locale === 'ar') {
    const match = /^ROOM(\d+)$/.exec(code);
    return match ? `غرفة تخزين ${match[1]}` : code;
  }
  return ROOM_NAMES[code] || code;
}

export function roomShortName(code, locale = 'en') {
  if (!code) return '—';
  const match = /^ROOM(\d+)$/.exec(code);
  if (locale === 'ar') return match ? `غرفة ${match[1]}` : code;
  return match ? `Room ${match[1]}` : code;
}

// numberingSystem: 'latn' keeps Western digits (0-9) even in Arabic — the
// app's data tables read more consistently that way than with Arabic-Indic
// numerals, while month/weekday names still render in Arabic.
export function formatNumber(value, locale = 'en') {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    numberingSystem: 'latn',
  }).format(value);
}

export function formatDate(value, locale = 'en') {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    numberingSystem: 'latn',
  }).format(d);
}

export function formatDateTime(value, locale = 'en') {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    numberingSystem: 'latn',
  }).format(d);
}

export function formatRelativeTime(value, locale = 'en') {
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
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', {
    numeric: 'auto',
    numberingSystem: 'latn',
  });
  for (const [unit, secs] of divisions) {
    if (Math.abs(diffSec) >= secs || unit === 'second') {
      return rtf.format(Math.round(diffSec / secs), unit);
    }
  }
  return formatDateTime(value, locale);
}

const MOVEMENT_LABELS_AR = {
  ADD: 'إضافة مخزون',
  REMOVE: 'سحب مخزون',
  ADJUST: 'تعديل مخزون',
  TRANSFER: 'نقل مخزون',
};

export function movementLabel(type, locale = 'en') {
  if (locale === 'ar') return MOVEMENT_LABELS_AR[type] || type || 'حركة';
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

const ROLE_LABELS_AR = {
  ADMIN: 'مسؤول',
  MANAGER: 'مدير',
  STAFF: 'موظف',
  VIEWER: 'مشاهد',
};

export function roleLabel(role, locale = 'en') {
  if (!role) return '—';
  if (locale === 'ar') return ROLE_LABELS_AR[role] || role;
  return role.charAt(0) + role.slice(1).toLowerCase();
}

const AUDIT_ACTION_LABELS = {
  LOGIN: 'Signed In',
  LOGIN_FAILED: 'Failed Sign-In',
  LOGOUT: 'Signed Out',
  ITEM_CREATE: 'Item Created',
  ITEM_UPDATE: 'Item Updated',
  ITEM_DELETE: 'Item Deleted',
  STOCK_ADD: 'Stock Added',
  STOCK_REMOVE: 'Stock Removed',
  STOCK_ADJUST: 'Stock Adjusted',
  STOCK_TRANSFER: 'Stock Transferred',
  ROOM_CREATE: 'Room Created',
  ROOM_UPDATE: 'Room Updated',
  ROOM_DELETE: 'Room Deleted',
  USER_CREATE: 'User Created',
  USER_UPDATE: 'User Updated',
  ALERT_RESOLVE: 'Alert Resolved',
  IMPORT_CSV: 'File Imported',
  BACKUP_CREATE: 'Backup Created',
  BACKUP_DOWNLOAD: 'Backup Downloaded',
  CATEGORY_CREATE: 'Category Created',
  CATEGORY_UPDATE: 'Category Updated',
  CATEGORY_DELETE: 'Category Deleted',
  SUPPLIER_CREATE: 'Supplier Created',
  SUPPLIER_UPDATE: 'Supplier Updated',
  SUPPLIER_DELETE: 'Supplier Deleted',
};

const AUDIT_ACTION_LABELS_AR = {
  LOGIN: 'تسجيل دخول',
  LOGIN_FAILED: 'محاولة دخول فاشلة',
  LOGOUT: 'تسجيل خروج',
  ITEM_CREATE: 'تمت إضافة صنف',
  ITEM_UPDATE: 'تم تعديل صنف',
  ITEM_DELETE: 'تم حذف صنف',
  STOCK_ADD: 'تمت إضافة مخزون',
  STOCK_REMOVE: 'تم سحب مخزون',
  STOCK_ADJUST: 'تم تعديل مخزون',
  STOCK_TRANSFER: 'تم نقل مخزون',
  ROOM_CREATE: 'تمت إضافة غرفة',
  ROOM_UPDATE: 'تم تعديل غرفة',
  ROOM_DELETE: 'تم حذف غرفة',
  USER_CREATE: 'تمت إضافة مستخدم',
  USER_UPDATE: 'تم تعديل مستخدم',
  ALERT_RESOLVE: 'تم حل تنبيه',
  IMPORT_CSV: 'تم استيراد ملف',
  BACKUP_CREATE: 'تم إنشاء نسخة احتياطية',
  BACKUP_DOWNLOAD: 'تم تنزيل نسخة احتياطية',
  CATEGORY_CREATE: 'تمت إضافة فئة',
  CATEGORY_UPDATE: 'تم تعديل فئة',
  CATEGORY_DELETE: 'تم حذف فئة',
  SUPPLIER_CREATE: 'تمت إضافة مورد',
  SUPPLIER_UPDATE: 'تم تعديل مورد',
  SUPPLIER_DELETE: 'تم حذف مورد',
};

export function auditActionLabel(action, locale = 'en') {
  if (!action) return '—';
  if (locale === 'ar') return AUDIT_ACTION_LABELS_AR[action] || action;
  return AUDIT_ACTION_LABELS[action] || titleCase(action.replace(/_/g, ' '));
}

export function titleCase(value) {
  if (!value) return '';
  return String(value)
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}
