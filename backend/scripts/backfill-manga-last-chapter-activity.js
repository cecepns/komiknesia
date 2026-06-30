#!/usr/bin/env node
/**
 * Backfill manga.last_chapter_activity_at in small batches (no long table lock).
 * Run manually when server load is low:
 *   node backend/scripts/backfill-manga-last-chapter-activity.js
 */
'use strict';

const db = require('../db');

const BATCH_SIZE = 500;
const PAUSE_MS = 300;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function columnExists() {
  const [rows] = await db.execute(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'manga'
      AND COLUMN_NAME = 'last_chapter_activity_at'
  `
  );
  return Number(rows[0]?.c) > 0;
}

async function backfillBatch() {
  const [result] = await db.execute(
    `
    UPDATE manga m
    INNER JOIN (
      SELECT c.manga_id, MAX(COALESCE(c.scheduled_release_at, c.created_at)) AS activity_at
      FROM chapters c
      INNER JOIN (
        SELECT id FROM manga WHERE last_chapter_activity_at IS NULL LIMIT ?
      ) pending ON pending.id = c.manga_id
      WHERE c.scheduled_release_at IS NULL OR c.scheduled_release_at <= NOW()
      GROUP BY c.manga_id
    ) lc ON lc.manga_id = m.id
    SET m.last_chapter_activity_at = lc.activity_at
    WHERE m.last_chapter_activity_at IS NULL
  `,
    [BATCH_SIZE]
  );
  return result?.affectedRows ?? 0;
}

async function main() {
  if (!(await columnExists())) {
    console.error(
      'Kolom last_chapter_activity_at belum ada. Jalankan dulu:\n' +
        '  backend/db/migrations/20260630_manga_last_chapter_activity.sql'
    );
    process.exit(1);
  }

  let total = 0;
  let batch = 0;

  for (;;) {
    batch += 1;
    const affected = await backfillBatch();
    total += affected;
    console.log(`[batch ${batch}] updated ${affected} rows (total ${total})`);
    if (affected === 0) break;
    await sleep(PAUSE_MS);
  }

  console.log(`Done. Total rows updated: ${total}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
