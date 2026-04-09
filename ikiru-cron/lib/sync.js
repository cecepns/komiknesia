/**
 * Memanggil backend: POST /api/ikiru/cron-sync
 * Lihat backend/controllers/IkiruSyncController.js — cronSyncFeed
 */

const DEFAULT_TIMEOUT_MS = 900000;

function getFeedType() {
  const t = String(process.env.IKIRU_CRON_FEED_TYPE || 'latest').toLowerCase();
  return t === 'project' ? 'project' : 'latest';
}

function buildCronSyncUrl(params) {
  const base = String(process.env.IKIRU_CRON_BASE_URL || 'http://127.0.0.1:3001');
  if (!base) {
    throw new Error('Set IKIRU_CRON_BASE_URL di .env');
  }

  const url = new URL(`${base}/api/ikiru/cron-sync`);
  const q = new URLSearchParams();
  q.set('type', params.type ?? getFeedType());
  q.set('page', String(params.page ?? 1));
  q.set('mode', params.mode === 'delta' ? 'delta' : 'full');
  q.set('withImages', params.withImages === false ? 'false' : 'true');
  q.set('saveToS3', params.saveToS3 === true ? 'true' : 'false');
  url.search = q.toString();
  return url.toString();
}

/**
 * @param {{ page?: number, mode?: 'full'|'delta', withImages?: boolean, saveToS3?: boolean, type?: string }} opts
 */
async function triggerCronSync(opts = {}) {
  const url = buildCronSyncUrl(opts);
  const timeoutMs = Number(process.env.IKIRU_CRON_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const secret = process.env.IKIRU_CRON_SECRET;
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    if (!res.ok) {
      const err = new Error(`cron-sync HTTP ${res.status}`);
      err.body = body;
      throw err;
    }

    if (body && body.status === false) {
      const err = new Error(body.error || 'cron-sync status false');
      err.body = body;
      throw err;
    }

    return body;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { triggerCronSync, buildCronSyncUrl, getFeedType };
