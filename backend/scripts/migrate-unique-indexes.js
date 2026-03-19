/* eslint-disable no-undef */
/* eslint-env node */
const db = require('../db');

async function indexExists(tableName, indexName) {
  const [rows] = await db.execute(
    `
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?
      LIMIT 1
    `,
    [tableName, indexName]
  );
  return rows.length > 0;
}

async function ensureIndex({ table, name, ddl }) {
  const exists = await indexExists(table, name);
  if (exists) {
    console.log(`OK (exists): ${table}.${name}`);
    return;
  }
  console.log(`Creating: ${table}.${name}`);
  await db.execute(ddl);
  console.log(`OK (created): ${table}.${name}`);
}

async function main() {
  await ensureIndex({
    table: 'chapters',
    name: 'unique_chapter_slug',
    ddl: 'ALTER TABLE `chapters` ADD UNIQUE KEY `unique_chapter_slug` (`slug`)',
  });

  await ensureIndex({
    table: 'chapter_images',
    name: 'unique_chapter_page',
    ddl: 'ALTER TABLE `chapter_images` ADD UNIQUE KEY `unique_chapter_page` (`chapter_id`, `page_number`)',
  });

  await ensureIndex({
    table: 'chapter_images',
    name: 'unique_chapter_image_path',
    ddl: 'ALTER TABLE `chapter_images` ADD UNIQUE KEY `unique_chapter_image_path` (`chapter_id`, `image_path`)',
  });

  console.log('Done.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

