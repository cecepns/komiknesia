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
  const d = parseScheduledDate(scheduledAt);
  if (!d) return false;
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
  const d = parseScheduledDate(row.scheduled_release_at);
  if (!d) return null;
  return {
    time: Math.floor(d.getTime() / 1000),
    formatted: d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
  };
}

/** Parse DATETIME dari MySQL (string atau Date object dari driver). */
function parseScheduledDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const s = String(value ?? '').trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
    const d = new Date(s.replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const SCHEDULE_WEEKDAY_TO_KEY = {
  Mon: 'monday',
  Tue: 'tuesday',
  Wed: 'wednesday',
  Thu: 'thursday',
  Fri: 'friday',
  Sat: 'saturday',
  Sun: 'sunday',
};

/** Hari jadwal (Senin–Minggu) berdasarkan waktu WIB. */
function getScheduleDayKey(scheduledAt) {
  const d = parseScheduledDate(scheduledAt);
  if (!d) return null;

  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
  }).format(d);

  return SCHEDULE_WEEKDAY_TO_KEY[weekday] || null;
}

function formatDateOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  const s = String(value ?? '').trim();
  if (!s) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = parseScheduledDate(s);
  if (!d) return s;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Recompute denormalized sort column for one manga (cheap: scoped to manga_id). */
let activityColumnReadyCache = null;

async function isActivityColumnReady(db) {
  if (activityColumnReadyCache !== null) return activityColumnReadyCache;
  try {
    const [rows] = await db.execute(
      `
      SELECT COUNT(*) AS c
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'manga'
        AND COLUMN_NAME = 'last_chapter_activity_at'
    `
    );
    activityColumnReadyCache = Number(rows[0]?.c) > 0;
  } catch {
    activityColumnReadyCache = false;
  }
  return activityColumnReadyCache;
}

async function refreshMangaChapterActivity(db, mangaId) {
  if (mangaId == null) return;
  if (!(await isActivityColumnReady(db))) return;
  try {
    await db.execute(
      `
      UPDATE manga m
      SET m.last_chapter_activity_at = (
        SELECT MAX(COALESCE(c.scheduled_release_at, c.created_at))
        FROM chapters c
        WHERE c.manga_id = m.id
          AND ${CHAPTER_RELEASED_WHERE_BARE}
      )
      WHERE m.id = ?
    `,
      [mangaId]
    );
  } catch (err) {
    console.error('refreshMangaChapterActivity failed for manga', mangaId, err.message);
  }
}

function mapLastChapterRow(row) {
  const createdTs =
    parseInt(row.release_at_timestamp, 10) ||
    parseInt(row.created_at_timestamp, 10) ||
    0;
  const updatedRaw = row.updated_at_timestamp;
  const updatedTs =
    updatedRaw != null && updatedRaw !== '' ? parseInt(updatedRaw, 10) : null;
  const chapter = {
    number: row.number,
    title: row.title,
    slug: row.slug,
    created_at: { time: createdTs },
  };
  if (updatedTs != null && !Number.isNaN(updatedTs)) {
    chapter.updated_at = { time: updatedTs };
  }
  return chapter;
}

/**
 * Top N released chapters per manga.
 * Scoped to the given manga IDs only (uses manga_id index), then capped in JS.
 */
async function fetchLastChaptersByMangaIds(db, mangaIds, limit = 3) {
  if (!Array.isArray(mangaIds) || mangaIds.length === 0) {
    return {};
  }

  const uniqueIds = [...new Set(mangaIds.map((id) => parseInt(id, 10)).filter((id) => !Number.isNaN(id)))];
  if (uniqueIds.length === 0) return {};

  const placeholders = uniqueIds.map(() => '?').join(',');
  const safeLimit = Math.min(Math.max(parseInt(String(limit), 10) || 3, 1), 10);

  const [rows] = await db.execute(
    `
    SELECT
      c.manga_id,
      c.chapter_number AS number,
      c.title,
      c.slug,
      UNIX_TIMESTAMP(COALESCE(c.scheduled_release_at, c.created_at)) AS release_at_timestamp,
      UNIX_TIMESTAMP(c.created_at) AS created_at_timestamp,
      UNIX_TIMESTAMP(c.updated_at) AS updated_at_timestamp
    FROM chapters c
    WHERE c.manga_id IN (${placeholders})
      AND ${CHAPTER_RELEASED_WHERE}
    ORDER BY c.manga_id ASC, CAST(c.chapter_number AS UNSIGNED) DESC, c.created_at DESC
  `,
    uniqueIds
  );

  const acc = {};
  for (const row of rows) {
    if (!acc[row.manga_id]) acc[row.manga_id] = [];
    if (acc[row.manga_id].length < safeLimit) {
      acc[row.manga_id].push(mapLastChapterRow(row));
    }
  }
  return acc;
}

module.exports = {
  CHAPTER_RELEASED_WHERE,
  CHAPTER_RELEASED_WHERE_BARE,
  CHAPTER_EFFECTIVE_ACTIVITY,
  CHAPTER_EFFECTIVE_ACTIVITY_BARE,
  CHAPTER_ACTIVITY_SUBQUERY,
  parseScheduledReleaseAt,
  parseScheduledDate,
  getScheduleDayKey,
  formatDateOnly,
  isScheduledReleaseInFuture,
  normalizeScheduledForResponse,
  refreshMangaChapterActivity,
  fetchLastChaptersByMangaIds,
  mapLastChapterRow,
  isActivityColumnReady,
};
