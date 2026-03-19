/* eslint-disable no-undef */
/* eslint-env node */
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Usage: node scripts/apply-sql.js <path-to-sql>');
    process.exit(1);
  }

  const absPath = path.isAbsolute(fileArg)
    ? fileArg
    : path.join(__dirname, '..', fileArg);

  const sql = fs.readFileSync(absPath, 'utf8');
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('--'));

  for (const stmt of statements) {
    // Add the semicolon back for logging clarity
    const printable = stmt.endsWith(';') ? stmt : `${stmt};`;
    console.log('Running:', printable);
    // mysql2 pool supports multiple statements only if enabled; execute one-by-one.
    // Some ALTER TABLE statements contain newlines; that's fine.
    await db.execute(stmt);
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

