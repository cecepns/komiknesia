const axios = require('axios');
const cheerio = require('cheerio');
const { connect } = require('puppeteer-real-browser');

let browserInstance = null;
let activePage = null;
let isLaunching = false;

// Queue / Mutex to prevent multiple requests from colliding on the same page
let queuePromise = Promise.resolve();

function enqueue(task) {
  const next = queuePromise.then(task, task);
  queuePromise = next.catch(() => {});
  return next;
}

async function getBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.version();
      return { browser: browserInstance, page: activePage };
    } catch {
      browserInstance = null;
      activePage = null;
    }
  }

  if (isLaunching) {
    while (isLaunching) {
      await new Promise((r) => setTimeout(r, 300));
    }
    if (browserInstance) {
      return { browser: browserInstance, page: activePage };
    }
  }

  isLaunching = true;
  try {
    const { browser, page } = await connect({
      headless: 'auto',
      turnstile: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1280,800',
      ],
    });
    browserInstance = browser;
    activePage = page;
    return { browser, page };
  } finally {
    isLaunching = false;
  }
}

async function closeBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch {}
    browserInstance = null;
    activePage = null;
  }
}

async function performFetchWithRealBrowser(url) {
  const { page } = await getBrowser();
  console.log(`[RealBrowser] Membuka URL: ${url}...`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (err) {
    console.warn(`[RealBrowser] page.goto warning: ${err.message}`);
  }

  // Tunggu challenge diselesaikan otomatis oleh turnstile solver
  for (let i = 0; i < 20; i++) {
    let title = '';
    try {
      title = (await page.title()) || '';
    } catch (e) {
      // Detached frame saat reload / redirect
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    if (
      title &&
      !title.toLowerCase().includes('just a moment') &&
      !title.toLowerCase().includes('tunggu sebentar') &&
      !title.toLowerCase().includes('attention required') &&
      !title.toLowerCase().includes('verifikasi')
    ) {
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Jeda singkat agar DOM render sempurna
  await new Promise((r) => setTimeout(r, 1000));

  let content = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      content = await page.content();
      if (content) break;
    } catch (e) {
      console.warn(`[RealBrowser] Retrying content read due to: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (!content) {
    throw new Error('Gagal membaca konten halaman dari browser');
  }

  return cheerio.load(content);
}

async function fetchWithRealBrowser(url) {
  // Masukkan request ke queue agar dieksekusi secara serial dan aman dari konflik Frame
  return enqueue(() => performFetchWithRealBrowser(url));
}

async function fetchHtml(url, options = {}) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    ...options.headers,
  };

  try {
    const res = await axios.get(url, { headers, timeout: 15000 });
    const text = String(res.data || '');
    if (
      text.includes('Just a moment...') ||
      text.includes('cf-browser-verification') ||
      text.includes('challenge-running') ||
      text.includes('Melakukan verifikasi keamanan')
    ) {
      console.log(`[Cloudflare Detected] Beralih ke Real Browser untuk: ${url}`);
      return await fetchWithRealBrowser(url);
    }
    return cheerio.load(res.data);
  } catch (error) {
    if (error.response && [403, 503].includes(error.response.status)) {
      console.log(`[Cloudflare ${error.response.status}] Beralih ke Real Browser untuk: ${url}`);
      return await fetchWithRealBrowser(url);
    }
    console.warn(`[fetchHtml] Axios gagal (${error.message}), mencoba Real Browser...`);
    try {
      return await fetchWithRealBrowser(url);
    } catch (realErr) {
      throw new Error(`Gagal mengambil data dari ${url}: ${realErr.message}`);
    }
  }
}

module.exports = {
  fetchHtml,
  fetchWithRealBrowser,
  getBrowser,
  closeBrowser,
};
