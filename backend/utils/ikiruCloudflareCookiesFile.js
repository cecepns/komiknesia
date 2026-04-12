const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const COOKIE_FILE = path.join(DATA_DIR, 'ikiru-cloudflare-cookies.txt');

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * @returns {string} trimmed cookie header value or empty
 */
function readIkiruCloudflareCookiesSync() {
  try {
    if (!fs.existsSync(COOKIE_FILE)) return '';
    return fs.readFileSync(COOKIE_FILE, 'utf8').trim();
  } catch {
    return '';
  }
}

function getIkiruCloudflareCookiesFileMeta() {
  const raw = readIkiruCloudflareCookiesSync();
  return {
    hasCookie: Boolean(raw),
    length: raw.length,
  };
}

/**
 * @param {string} content full Cookie header string (cf_clearance=...; __cf_bm=...)
 */
function writeIkiruCloudflareCookiesFile(content) {
  ensureDataDir();
  const trimmed = String(content || '').trim();
  fs.writeFileSync(COOKIE_FILE, trimmed, 'utf8');
  try {
    fs.chmodSync(COOKIE_FILE, 0o600);
  } catch {
    /* windows / fs tanpa chmod */
  }
}

function clearIkiruCloudflareCookiesFile() {
  try {
    if (fs.existsSync(COOKIE_FILE)) fs.unlinkSync(COOKIE_FILE);
  } catch {
    /* ignore */
  }
}

module.exports = {
  COOKIE_FILE,
  readIkiruCloudflareCookiesSync,
  getIkiruCloudflareCookiesFileMeta,
  writeIkiruCloudflareCookiesFile,
  clearIkiruCloudflareCookiesFile,
};
