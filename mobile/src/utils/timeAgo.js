/**
 * Format timestamp or date string into readable Indonesian relative time
 * @param {string|number|Date} dateVal
 * @returns {string}
 */
export function timeAgo(dateVal) {
  if (!dateVal) return '';

  let timestamp = 0;
  if (typeof dateVal === 'number') {
    timestamp = dateVal < 1e12 ? dateVal * 1000 : dateVal;
  } else if (typeof dateVal === 'string') {
    // If it's a numeric string
    if (/^\d+$/.test(dateVal.trim())) {
      const n = Number(dateVal.trim());
      timestamp = n < 1e12 ? n * 1000 : n;
    } else {
      timestamp = new Date(dateVal.replace(' ', 'T')).getTime();
    }
  } else if (dateVal instanceof Date) {
    timestamp = dateVal.getTime();
  }

  if (isNaN(timestamp) || timestamp <= 0) return '';

  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);

  if (diffSec < 60) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} hari lalu`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks} mgg lalu`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} bln lalu`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} thn lalu`;
}

export function formatDate(dateVal) {
  if (!dateVal) return '-';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}
