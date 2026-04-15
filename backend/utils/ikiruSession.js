/* eslint-disable no-undef */
/* eslint-env node */
/**
 * Ikiru web login for scrape/sync (cookie jar).
 * Default login: Whyuu / komiknesia; env IKIRU_AUTH_EMAIL (atau IKIRU_AUTH_USER) dan IKIRU_AUTH_PASSWORD menggantikan.
 * Jika hanya salah satu env di-set, error (hindari setengah override).
 * Cloudflare: cookie file data/ikiru-cloudflare-cookies.txt (PUT admin) atau env; diterapkan ke jar sebelum login.
 * Tanpa kredensial efektif: jika cookie CF ada, error; tanpa CF: plain axios.
 * Dipakai oleh IkiruSyncController (cron-sync & admin) dan IkiruScrapController.
 */
const axios = require('axios');
const cheerio = require('cheerio');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const { readIkiruCloudflareCookiesSync } = require('./ikiruCloudflareCookiesFile');

const IKIRU_ORIGIN = 'https://02.ikiru.wtf';

/**
 * Cookie Cloudflare: file backend/data/ikiru-cloudflare-cookies.txt (diset dari admin Ikiru Sync),
 * lalu opsional env IKIRU_CLOUDFLARE_COOKIES / IKIRU_CF_COOKIES.
 */
function getIkiruCloudflareCookieRaw() {
  const fromFile = readIkiruCloudflareCookiesSync();
  if (fromFile) return fromFile;
  return String(
    process.env.IKIRU_CLOUDFLARE_COOKIES || process.env.IKIRU_CF_COOKIES || ''
  ).trim();
}

function cloudflareChallengeDetected(html) {
  if (typeof html !== 'string' || html.length < 80) return false;
  const head = html.slice(0, 12000);
  return (
    head.includes('Just a moment') ||
    head.includes('cf_chl_') ||
    head.includes('challenge-platform') ||
    head.includes('Enable JavaScript and cookies') ||
    head.includes('__cf_chl_') ||
    head.includes('window._cf_chl_opt')
  );
}

function cloudflareBlockedError() {
  return new Error(
    'Ikiru membalas halaman Cloudflare (verifikasi bot / "Just a moment"). ' +
      'Simpan header Cookie untuk https://02.ikiru.wtf lewat Admin → Ikiru Sync (form Cloudflare), atau file backend/data/ikiru-cloudflare-cookies.txt. ' +
      'Salin dari DevTools → Application → Cookies atau Network (request yang sudah lolos CF); sertakan cf_clearance jika ada. ' +
      'Cookie umumnya terikat IP server. Alternatif: env IKIRU_CLOUDFLARE_COOKIES.'
  );
}

/**
 * @param {import('tough-cookie').CookieJar} jar
 */
async function applyCloudflareCookiesToJar(jar) {
  const raw = getIkiruCloudflareCookieRaw();
  if (!raw) return;
  const parts = raw.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || !trimmed.includes('=')) continue;
    try {
      await jar.setCookie(trimmed, IKIRU_ORIGIN, { ignoreError: true });
    } catch {
      /* skip invalid segments */
    }
  }
}

/** Fallback bila env IKIRU_AUTH_* tidak di-set (env tetap menang jika lengkap). */
const HARDCODED_IKIRU_USERNAME = 'Whyuu';
const HARDCODED_IKIRU_PASSWORD = 'komiknesia';

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const SESSION_TTL_MS = 45 * 60 * 1000;

let _jarClient = null;
let _sessionExpiresAt = 0;
let _loginPromise = null;

function readIkiruAuthOverridesFromEnv() {
  const email = String(process.env.IKIRU_AUTH_EMAIL || process.env.IKIRU_AUTH_USER || '').trim();
  const password = String(process.env.IKIRU_AUTH_PASSWORD || '').trim();
  return { email, password };
}

function readIkiruAuthFromEnv() {
  const o = readIkiruAuthOverridesFromEnv();
  return {
    email: o.email || HARDCODED_IKIRU_USERNAME,
    password: o.password || HARDCODED_IKIRU_PASSWORD,
  };
}

function getAuthEmail() {
  const { email } = readIkiruAuthFromEnv();
  return email;
}

function getAuthPassword() {
  const { password } = readIkiruAuthFromEnv();
  return password;
}

function hasIkiruCredentials() {
  const { email, password } = readIkiruAuthFromEnv();
  return Boolean(email && password);
}

function ikiruAuthIncompleteError() {
  return new Error(
    'Ikiru: setel IKIRU_AUTH_EMAIL (atau IKIRU_AUTH_USER) dan IKIRU_AUTH_PASSWORD — salah satu masih kosong.'
  );
}

function ikiruLoginRequiredWithCfError() {
  return new Error(
    'Ikiru scrape/sync membutuhkan login: set IKIRU_AUTH_EMAIL dan IKIRU_AUTH_PASSWORD di environment. ' +
      'Cookie Cloudflare (admin / file / env) dipakai bersama jar saat login; header Cookie CF saja tidak menggantikan sesi akun.'
  );
}

function parseLoginPostUrlFromAuthPage($) {
  const form = $('#auth-form').first();
  if (!form.length) return null;
  let hxPost = form.attr('hx-post') || '';
  hxPost = hxPost.replace(/&amp;/g, '&').trim();
  if (!hxPost || !hxPost.includes('admin-ajax.php')) return null;
  if (hxPost.startsWith('http')) return hxPost;
  if (hxPost.startsWith('//')) return 'https:' + hxPost;
  if (hxPost.startsWith('/')) return IKIRU_ORIGIN + hxPost;
  return `${IKIRU_ORIGIN}/${hxPost}`;
}

function parseAjaxLoginResponse(data) {
  if (data == null) return;
  if (typeof data === 'object' && 'success' in data) {
    if (data.success === false) {
      const msg =
        (data.data && (typeof data.data === 'string' ? data.data : data.data.message)) || 'login ditolak';
      throw new Error(`Ikiru login: ${msg}`);
    }
    return;
  }
  if (typeof data !== 'string') return;
  const trimmed = data.trim();
  if (!trimmed.startsWith('{')) return;
  try {
    const j = JSON.parse(trimmed);
    if (j.success === false) {
      const msg =
        (j.data && (typeof j.data === 'string' ? j.data : j.data.message)) || 'login ditolak';
      throw new Error(`Ikiru login: ${msg}`);
    }
  } catch (e) {
    if (e.message.startsWith('Ikiru login:')) throw e;
  }
}

function authFormStillPresent(html) {
  const $ = cheerio.load(html);
  return Boolean($('#auth-form').find('input[name="password"]').length);
}

async function performIkiruLogin() {
  const jar = new CookieJar();
  await applyCloudflareCookiesToJar(jar);

  const client = wrapper(
    axios.create({
      jar,
      timeout: 25000,
      maxRedirects: 7,
      headers: {
        'User-Agent': DEFAULT_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
  );

  const authPageUrl = `${IKIRU_ORIGIN}/auth/`;
  const authRes = await client.get(authPageUrl);
  const authHtml =
    typeof authRes.data === 'string' ? authRes.data : String(authRes.data ?? '');
  if (cloudflareChallengeDetected(authHtml)) {
    throw cloudflareBlockedError();
  }
  const $auth = cheerio.load(authHtml);

  const loginUrl = parseLoginPostUrlFromAuthPage($auth);
  if (!loginUrl) {
    if (!authFormStillPresent(authHtml)) {
      throw new Error(
        'Ikiru auth: tidak ada #auth-form di /auth/ (sudah redirect ke beranda tanpa cookie, atau layout berubah).'
      );
    }
    throw new Error('Ikiru auth: tidak bisa membaca URL login (hx-post) dari halaman /auth/');
  }

  const body = new URLSearchParams({
    action: 'login_user',
    email: getAuthEmail(),
    password: getAuthPassword(),
  });

  const loginRes = await client.post(loginUrl, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: authPageUrl,
      Origin: IKIRU_ORIGIN,
    },
    validateStatus: (s) => s >= 200 && s < 500,
  });

  const loginRaw =
    typeof loginRes.data === 'string' ? loginRes.data : String(loginRes.data ?? '');
  if (cloudflareChallengeDetected(loginRaw)) {
    throw cloudflareBlockedError();
  }

  parseAjaxLoginResponse(loginRes.data);

  const verifyRes = await client.get(authPageUrl);
  const verifyHtml =
    typeof verifyRes.data === 'string' ? verifyRes.data : String(verifyRes.data ?? '');
  if (cloudflareChallengeDetected(verifyHtml)) {
    throw cloudflareBlockedError();
  }
  if (authFormStillPresent(verifyHtml)) {
    throw new Error('Ikiru login gagal: setelah POST masih muncul form login (cek kredensial / nonce).');
  }

  _jarClient = client;
  _sessionExpiresAt = Date.now() + SESSION_TTL_MS;
}

/**
 * @returns {Promise<import('axios').AxiosInstance>}
 */
async function getIkiruAxios() {
  const envOnly = readIkiruAuthOverridesFromEnv();
  const hasPartialEnv =
    Boolean(envOnly.email || envOnly.password) && !(envOnly.email && envOnly.password);
  if (hasPartialEnv) {
    throw ikiruAuthIncompleteError();
  }

  const { email, password } = readIkiruAuthFromEnv();
  const hasBoth = Boolean(email && password);
  if (!hasBoth) {
    const cf = getIkiruCloudflareCookieRaw();
    if (cf) {
      throw ikiruLoginRequiredWithCfError();
    }
    return axios;
  }

  const now = Date.now();
  if (_jarClient && now < _sessionExpiresAt) {
    return _jarClient;
  }

  if (_loginPromise) {
    await _loginPromise;
    if (_jarClient && Date.now() < _sessionExpiresAt) return _jarClient;
  }

  _loginPromise = (async () => {
    _jarClient = null;
    _sessionExpiresAt = 0;
    await performIkiruLogin();
  })();

  try {
    await _loginPromise;
  } finally {
    _loginPromise = null;
  }

  return _jarClient;
}

function invalidateIkiruSession() {
  _jarClient = null;
  _sessionExpiresAt = 0;
}

/**
 * GET HTML dari Ikiru; sesi login (jar) memakai env atau default hardcoded.
 * @param {string} url Absolute URL (e.g. https://02.ikiru.wtf/manga/foo/)
 * @param {{ timeout?: number }} [opts]
 */
async function ikiruFetchHtml(url, { timeout = 20000 } = {}) {
  const http = await getIkiruAxios();
  let response;
  try {
    response = await http.get(url, {
      headers: { 'User-Agent': DEFAULT_UA },
      timeout,
    });
  } catch (err) {
    const body = err?.response?.data;
    const html = typeof body === 'string' ? body : '';
    if (cloudflareChallengeDetected(html)) {
      invalidateIkiruSession();
      throw cloudflareBlockedError();
    }
    throw err;
  }
  const html =
    typeof response.data === 'string' ? response.data : String(response.data ?? '');
  if (cloudflareChallengeDetected(html)) {
    invalidateIkiruSession();
    throw cloudflareBlockedError();
  }
  return cheerio.load(html);
}

module.exports = {
  IKIRU_ORIGIN,
  hasIkiruCredentials,
  getIkiruAxios,
  ikiruFetchHtml,
  invalidateIkiruSession,
};
