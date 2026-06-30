const db = require('../db');
const {
  normalizeScheduledForResponse,
  getScheduleDayKey,
  formatDateOnly,
} = require('../utils/chapterRelease');

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DAY_LABELS_ID = {
  monday: 'Senin',
  tuesday: 'Selasa',
  wednesday: 'Rabu',
  thursday: 'Kamis',
  friday: 'Jumat',
  saturday: 'Sabtu',
  sunday: 'Minggu',
};

function parseWeekOffset(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

function mapScheduleRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    chapter_number: row.chapter_number,
    title: row.title,
    scheduled_release_at: normalizeScheduledForResponse(row),
    manga: {
      id: row.manga_id,
      title: row.manga_title,
      slug: row.manga_slug,
      cover: row.manga_cover || null,
      thumbnail: row.manga_cover || null,
      is_project: !!row.is_project,
    },
  };
}

/**
 * GET /api/chapters/schedule?week=0
 * week: offset minggu dari minggu ini (0 = minggu berjalan, 1 = minggu depan, -1 = minggu lalu)
 */
const getSchedule = async (req, res) => {
  try {
    const weekOffset = parseWeekOffset(req.query.week);

    const [metaRows] = await db.execute(
      `
      SELECT
        DATE(DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL ? WEEK)) AS week_start,
        DATE(DATE_ADD(DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL ? WEEK), INTERVAL 6 DAY)) AS week_end
    `,
      [weekOffset, weekOffset]
    );

    const weekStart = metaRows[0]?.week_start;
    const weekEnd = metaRows[0]?.week_end;

    const [rows] = await db.execute(
      `
      SELECT
        c.id,
        c.slug,
        c.chapter_number,
        c.title,
        c.scheduled_release_at,
        UNIX_TIMESTAMP(c.scheduled_release_at) AS scheduled_release_at_timestamp,
        m.id AS manga_id,
        m.title AS manga_title,
        m.slug AS manga_slug,
        m.thumbnail AS manga_cover,
        m.is_project
      FROM chapters c
      INNER JOIN manga m ON m.id = c.manga_id
      WHERE c.scheduled_release_at IS NOT NULL
        AND c.scheduled_release_at > NOW()
        AND DATE(c.scheduled_release_at) BETWEEN ? AND ?
      ORDER BY c.scheduled_release_at ASC
    `,
      [weekStart, weekEnd]
    );

    const days = {};
    for (const key of DAY_KEYS) {
      days[key] = [];
    }

    for (const row of rows) {
      const key = getScheduleDayKey(row.scheduled_release_at);
      if (!key || !days[key]) {
        console.warn(
          'Skip schedule row: could not resolve day bucket',
          row.id,
          row.scheduled_release_at
        );
        continue;
      }
      days[key].push(mapScheduleRow(row));
    }

    res.json({
      status: true,
      week_offset: weekOffset,
      week_start: formatDateOnly(weekStart),
      week_end: formatDateOnly(weekEnd),
      day_labels: DAY_LABELS_ID,
      days,
      total: rows.length,
    });
  } catch (error) {
    console.error('Error fetching chapter schedule:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = { getSchedule };
