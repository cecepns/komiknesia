/* eslint-disable no-undef */
/* eslint-env node */
/**
 * Chapter release scheduling helpers.
 * - NULL scheduled_release_at → rilis langsung (created_at)
 * - Future scheduled_release_at → hanya tampil di halaman Jadwal sampai waktunya
 */

/** SQL fragment: chapter sudah dirilis ke publik */
const CHAPTER_RELEASED_WHERE = '(c.scheduled_release_at IS NULL OR c.scheduled_release_at <= NOW())';

/** SQL fragment tanpa alias tabel */
const CHAPTER_RELEASED_WHERE_BARE = '(scheduled_release_at IS NULL OR scheduled_release_at <= NOW())';

/** Timestamp aktivitas untuk sort Terbaru/Project */
const CHAPTER_EFFECTIVE_ACTIVITY = 'COALESCE(c.scheduled_release_at, c.created_at)';

const CHAPTER_EFFECTIVE_ACTIVITY_BARE = 'COALESCE(scheduled_release_at, created_at)';

/** Subquery MAX aktivitas chapter per manga (hanya yang sudah rilis) */
const CHAPTER_ACTIVITY_SUBQUERY = `
  SELECT manga_id, MAX(${CHAPTER_EFFECTIVE_ACTIVITY_BARE}) AS last_chapter_activity_at
  FROM chapters
  WHERE ${CHAPTER_RELEASED_WHERE_BARE}
  GROUP BY manga_id
`;

function parseScheduledReleaseAt(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  if (s.toLowerCase() === 'null') return null;

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
    return `${s.replace('T', ' ')}:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
    return s.replace('T', ' ');
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) {
    return s.length === 16 ? `${s}:00` : s;
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function isScheduledReleaseInFuture(scheduledAt) {
  if (!scheduledAt) return false;
  const d = new Date(String(scheduledAt).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() > Date.now();
}

function normalizeScheduledForResponse(row) {
  if (!row?.scheduled_release_at) return null;
  const ts = row.scheduled_release_at_timestamp
    ? parseInt(row.scheduled_release_at_timestamp, 10)
    : null;
  if (ts) {
    return { time: ts, formatted: new Date(ts * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) };
  }
  const d = new Date(String(row.scheduled_release_at).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  return {
    time: Math.floor(d.getTime() / 1000),
    formatted: d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
  };
}

module.exports = {
  CHAPTER_RELEASED_WHERE,
  CHAPTER_RELEASED_WHERE_BARE,
  CHAPTER_EFFECTIVE_ACTIVITY,
  CHAPTER_EFFECTIVE_ACTIVITY_BARE,
  CHAPTER_ACTIVITY_SUBQUERY,
  parseScheduledReleaseAt,
  isScheduledReleaseInFuture,
  normalizeScheduledForResponse,
};
