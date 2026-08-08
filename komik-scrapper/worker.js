/**
 * Cloudflare Worker - Interactive Scrapper UI (Full Port of App.jsx) & Auto Cron Trigger
 * Komiknesia Scrapper
 */

import * as cheerio from 'cheerio';

const DEFAULT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function cleanText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function slugifyGenre(text) {
  return cleanText(text)
    .toLowerCase()
    .replace(/[’'".]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function checkChapterExistsInBackend(apiBaseUrl, localSlug) {
  try {
    const apiBase = apiBaseUrl.replace(/\/api\/(admin\/)?scrapper-sync\/sync.*$/, '');
    const checkUrl = `${apiBase}/api/chapters/slug/${encodeURIComponent(localSlug)}`;
    const res = await fetch(checkUrl);
    if (res.status === 200) {
      const data = await res.json();
      return !!data.status;
    }
  } catch (e) {
    console.warn(`[Worker] Check chapter error:`, e.message);
  }
  return false;
}

async function scrapeApkomikList(pageUrl) {
  // Jika URL yang dimasukkan adalah URL single manga (misal: https://01.apkomik.com/manga/solo-leveling/)
  if (pageUrl.includes('/manga/')) {
    const slugMatch = pageUrl.match(/\/manga\/([^/?#]+)/i);
    if (slugMatch && slugMatch[1]) {
      const slug = slugMatch[1].replace(/\/$/, '').trim();
      return [{ title: slug.replace(/-/g, ' '), slug, url: pageUrl }];
    }
  }

  const res = await fetch(pageUrl, { headers: { 'User-Agent': DEFAULT_UA } });
  const html = await res.text();
  const $ = cheerio.load(html);

  const list = [];
  const seen = new Set();
  const selectors = ['.listupd .bsx a', '.listupd .bs a', '.listupd .utao a', '#content .bsx a'];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/\/manga\/([^/?#]+)/i);
      if (match && match[1]) {
        const slug = match[1].replace(/\/$/, '').trim();
        if (!seen.has(slug)) {
          seen.add(slug);
          const title = cleanText($(el).find('.tt').text()) || cleanText($(el).attr('title')) || slug.replace(/-/g, ' ');
          list.push({ title, slug, url: href.startsWith('http') ? href : `https://01.apkomik.com/manga/${slug}/` });
        }
      }
    });
    if (list.length > 0) break;
  }
  return list;
}

async function scrapeApkomikDetail(slug, baseUrl = 'https://01.apkomik.com') {
  const mangaUrl = `${baseUrl}/manga/${slug}/`;
  const res = await fetch(mangaUrl, { headers: { 'User-Agent': DEFAULT_UA } });
  const html = await res.text();
  const $ = cheerio.load(html);

  const title = cleanText($('.entry-title').first().text()) || slug.replace(/-/g, ' ');
  let coverImage = $('.thumb img').first().attr('src') || $('.thumb img').first().attr('data-src');
  if (coverImage && coverImage.startsWith('//')) coverImage = 'https:' + coverImage;

  const synopsis = cleanText($('.entry-content p, [itemprop="description"] p').text());

  const genres = new Set();
  $('.mgen a').each((_, el) => {
    const gSlug = slugifyGenre($(el).text());
    if (gSlug) genres.add(gSlug);
  });

  const chapters = [];
  $('#chapterlist ul li, .cl ul li').each((_, el) => {
    const linkEl = $(el).find('a').first();
    const href = linkEl.attr('href') || '';
    if (!href) return;
    const chapterSlug = href.split('/').filter(Boolean).pop();
    const titleText = linkEl.find('.chapternum').text().trim() || linkEl.text().trim();
    const numMatch = chapterSlug.match(/chapter-([\d.]+)/i) || titleText.match(/chapter\s+([\d.]+)/i);
    chapters.push({
      title: titleText || chapterSlug,
      url: href.startsWith('http') ? href : baseUrl + href,
      slug: chapterSlug,
      chapterNumber: numMatch ? parseFloat(numMatch[1]) : null,
    });
  });

  return { slug, title, coverImage, synopsis, genres: Array.from(genres), chapters };
}

async function scrapeApkomikChapterImages(chapterUrl) {
  const res = await fetch(chapterUrl, { headers: { 'User-Agent': DEFAULT_UA } });
  const html = await res.text();
  const $ = cheerio.load(html);
  const images = [];

  $('script').each((_, el) => {
    const text = $(el).text();
    if (text.includes('ts_reader.run')) {
      const match = text.match(/ts_reader\.run\((.*?)\);/);
      if (match && match[1]) {
        try {
          const data = JSON.parse(match[1]);
          if (data.sources?.[0]?.images) {
            for (let src of data.sources[0].images) {
              if (src.startsWith('//')) src = 'https:' + src;
              images.push(src);
            }
          }
        } catch {}
      }
    }
  });

  if (images.length === 0) {
    $('#readerarea img').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src');
      if (src) {
        if (src.startsWith('//')) src = 'https:' + src;
        images.push(src);
      }
    });
  }
  return images;
}

async function uploadImageToR2(env, key, imageUrl, referer = 'https://01.apkomik.com/') {
  const publicDomain = (env.S3_PUBLIC_DOMAIN || 'https://data.cdnesia.my.id').replace(/\/$/, '');

  // 1. Cek apakah file sudah pernah diupload ke R2
  if (env.MY_BUCKET) {
    try {
      const head = await env.MY_BUCKET.head(key);
      if (head) {
        return `${publicDomain}/${key}`;
      }
    } catch (e) {}
  }

  // 2. Tentukan Header Anti-Hotlink
  const headers = {
    'User-Agent': DEFAULT_UA,
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Referer': referer,
  };

  try {
    const parsedUrl = new URL(imageUrl);
    const host = parsedUrl.hostname.toLowerCase();
    if (host.includes('kiryuu') || host.includes('kiryu') || host === 'yuucdn.com' || host.includes('itachi.my.id')) {
      headers['Referer'] = 'https://v6.kiryuu.to/';
      headers['access-code'] = 'NYQLFxYsnOy+/zwnNWmNTUN5';
    } else if (host.includes('apkomik') || host.includes('cdnap.site')) {
      headers['Referer'] = 'https://01.apkomik.com/';
      headers['Sec-Fetch-Dest'] = 'image';
      headers['Sec-Fetch-Mode'] = 'no-cors';
      headers['Sec-Fetch-Site'] = 'cross-site';
    }
  } catch (e) {}

  const imgRes = await fetch(imageUrl, { headers });
  if (!imgRes.ok) {
    throw new Error(`HTTP ${imgRes.status} fetching image`);
  }

  const arrayBuffer = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg';

  if (env.MY_BUCKET) {
    await env.MY_BUCKET.put(key, arrayBuffer, { httpMetadata: { contentType } });
  }

  return `${publicDomain}/${key}`;
}

async function processAutoScrap(env, targetPageUrl) {
  const pageUrl = targetPageUrl || 'https://01.apkomik.com/manhwa-terbaru';
  const backendApiUrl = env.KOMIKNESIA_API_URL;
  const secret = env.KOMIKNESIA_API_SECRET;

  const mangaList = await scrapeApkomikList(pageUrl);
  const summary = [];

  for (let i = 0; i < mangaList.length; i++) {
    const item = mangaList[i];
    try {
      const detail = await scrapeApkomikDetail(item.slug);
      if (!detail.chapters || detail.chapters.length === 0) continue;

      for (let c = 0; c < detail.chapters.length; c++) {
        const ch = detail.chapters[c];
        const localSlug = ch.slug.startsWith(`${detail.slug}-`) ? ch.slug : `${detail.slug}-${ch.slug}`;

        // CEK SUPAYA TIDAK MENIMPA / SKIP JIKA SUDAH ADA DI DB
        const exists = await checkChapterExistsInBackend(backendApiUrl, localSlug);
        if (exists) {
          summary.push({ slug: detail.slug, chapter: ch.title, status: 'skipped' });
          continue;
        }

        const images = await scrapeApkomikChapterImages(ch.url);
        const r2Images = [];
        for (let j = 0; j < images.length; j++) {
          const ext = images[j].split('?')[0].split('.').pop() || 'webp';
          const key = `komiknesia/apkomik/chapters/${detail.slug}/${ch.slug}/pages/${j + 1}.${ext}`;
          try {
            const r2Url = await uploadImageToR2(env, key, images[j], ch.url);
            r2Images.push(r2Url);
          } catch (err) {
            console.error(`[R2 Error] Failed to upload page ${j + 1} of ${detail.slug}:`, err.message);
          }
        }

        if (r2Images.length === 0) {
          summary.push({ slug: detail.slug, chapter: ch.title, status: 'error', error: 'R2 upload failed' });
          continue;
        }

        // Payload to Backend
        const payload = {
          source: 'apkomik',
          mangaDetail: {
            title: detail.title,
            slug: detail.slug,
            synopsis: detail.synopsis,
            coverImage: detail.coverImage,
            genres: detail.genres,
          },
          chapters: [{
            slug: ch.slug,
            title: ch.title,
            chapterNumber: ch.chapterNumber,
            images: r2Images,
          }],
        };

        const syncRes = await fetch(backendApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secret}`,
          },
          body: JSON.stringify(payload),
        });

        const syncData = await syncRes.json();
        summary.push({ slug: detail.slug, chapter: ch.title, status: 'synced', result: syncData });
      }

    } catch (err) {
      summary.push({ slug: item.slug, status: 'error', error: err.message });
    }
  }

  return summary;
}

function getExactUiAppHtml() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Komik Scrapper</title>
  <style>
    :root {
      font-family: 'Inter', system-ui, Avenir, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      font-weight: 400;
      color-scheme: dark;
      color: rgba(255, 255, 255, 0.87);
      background-color: #0d1117;
      --glass-bg: rgba(255, 255, 255, 0.05);
      --glass-border: rgba(255, 255, 255, 0.1);
      --primary: #58a6ff;
      --primary-hover: #79c0ff;
      --success: #2ea043;
      --bg-gradient: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg-gradient);
      display: flex;
      justify-content: center;
      padding: 2rem;
      box-sizing: border-box;
    }

    * { box-sizing: border-box; }

    #root { width: 100%; max-width: 900px; }

    .glass-panel {
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: 16px;
      padding: 2rem;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 1.5rem;
      text-align: center;
      background: -webkit-linear-gradient(0deg, #58a6ff, #a371f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .form-group {
      margin-bottom: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    label { font-size: 0.9rem; font-weight: 600; color: #8b949e; }

    input, select, textarea {
      width: 100%;
      padding: 0.8rem 1rem;
      border-radius: 8px;
      border: 1px solid var(--glass-border);
      background: rgba(0, 0, 0, 0.2);
      color: white;
      font-size: 1rem;
      font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    textarea { min-height: 120px; resize: vertical; }

    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2);
    }

    button {
      background: var(--primary);
      color: #0d1117;
      border: none;
      padding: 0.8rem 1.5rem;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 0.2s, transform 0.1s;
      width: 100%;
    }

    button:hover { background: var(--primary-hover); }
    button:active { transform: scale(0.98); }
    button:disabled { background: #30363d; color: #8b949e; cursor: not-allowed; }

    .preview-card {
      display: flex;
      gap: 1.5rem;
      margin-top: 2rem;
      background: rgba(0,0,0,0.2);
      padding: 1.5rem;
      border-radius: 12px;
      border: 1px solid var(--glass-border);
    }

    .preview-card img {
      width: 150px;
      height: 225px;
      object-fit: cover;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }

    .preview-info h2 { margin: 0 0 0.5rem 0; font-size: 1.5rem; }
    .preview-info p { margin: 0; color: #8b949e; font-size: 0.9rem; }

    .chapter-selection { margin-top: 2rem; }

    .chapter-list {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid var(--glass-border);
      border-radius: 8px;
      padding: 1rem;
      background: rgba(0,0,0,0.1);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .chapter-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      border-radius: 4px;
      cursor: pointer;
    }

    .chapter-item:hover { background: rgba(255,255,255,0.05); }

    .terminal-log {
      margin-top: 2rem;
      background: #010409;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 1rem;
      font-family: 'SF Mono', Menlo, Consolas, monospace;
      font-size: 0.85rem;
      height: 250px;
      overflow-y: auto;
      color: #c9d1d9;
    }

    .terminal-log p { margin: 0 0 0.25rem 0; }
    .terminal-log .success { color: #3fb950; }
    .terminal-log .error { color: #f85149; }
    .terminal-log .info { color: #58a6ff; }
    .terminal-log .normal { color: #c9d1d9; }

    .tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid var(--glass-border);
      padding-bottom: 0.5rem;
    }

    .tab-btn {
      background: transparent;
      color: #8b949e;
      border: none;
      padding: 0.5rem 1rem;
      font-size: 0.95rem;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      width: auto;
      transition: all 0.2s ease;
    }

    .tab-btn:hover { background: rgba(255, 255, 255, 0.05); color: white; }

    .tab-btn.active {
      background: rgba(88, 166, 255, 0.15);
      color: var(--primary);
      border: 1px solid rgba(88, 166, 255, 0.3);
    }

    .cron-box {
      background: rgba(88, 166, 255, 0.08);
      border: 1px solid rgba(88, 166, 255, 0.3);
      border-radius: 10px;
      padding: 1rem;
      margin-bottom: 1.5rem;
    }
  </style>
</head>
<body>
  <div id="root">
    <div class="glass-panel">
      <h1>Komik Scrapper</h1>

      <!-- CRON TRIGGER URL INFO -->
      <div class="cron-box" style="border: 1px solid rgba(88,166,255,0.3); border-radius: 10px; padding: 1rem; margin-bottom: 1.5rem; background: rgba(88,166,255,0.05);">
        <label style="color: #58a6ff; font-weight: bold;">⚡ Cloudflare Auto Cron / URL Trigger:</label>
        <p style="margin: 4px 0 8px 0; font-size: 0.82rem; color: #8b949e;">URL untuk pemicu otomatis via Cronjob / Browser langsung:</p>
        <div style="display: flex; gap: 0.5rem;">
          <input type="text" id="cron-url" readonly style="font-family: monospace; font-size: 0.85rem; color: #79c0ff;" />
          <button onclick="copyCronUrl()" style="width: auto; padding: 0.4rem 1rem; font-size: 0.85rem;">Copy URL</button>
        </div>
      </div>

      <div class="tabs">
        <button id="tab-single" class="tab-btn active" onclick="switchMode('single')">Single Manga</button>
        <button id="tab-bulk" class="tab-btn" onclick="switchMode('bulk')">Bulk Manga (Multiple)</button>
      </div>

      <div class="form-group">
        <label>Sumber Website</label>
        <select id="source-select">
          <option value="apkomik">Apkomik (01.apkomik.com)</option>
        </select>
      </div>

      <!-- SINGLE MODE -->
      <div id="mode-single-section">
        <div class="form-group">
          <label>Manga URL atau Slug</label>
          <input type="text" id="urlOrSlug" placeholder="https://... atau slug-komik">
        </div>

        <button id="btn-preview" onclick="fetchPreview()">Preview Manga</button>

        <div id="preview-container"></div>
      </div>

      <!-- BULK MODE -->
      <div id="mode-bulk-section" style="display: none;">
        <div class="form-group">
          <label>Metode Input Bulk</label>
          <select id="bulk-type-select" onchange="switchBulkType(this.value)">
            <option value="manual">Manual Input (Slug/URL per Baris)</option>
            <option value="list">Scrape Halaman Daftar Manga (Manga List Page)</option>
          </select>
        </div>

        <div id="bulk-manual-box" class="form-group">
          <label>Daftar Manga URL atau Slug (satu per baris)</label>
          <textarea id="bulkInput" placeholder="https://01.apkomik.com/manga/slug-komik-1&#10;slug-komik-2"></textarea>
        </div>

        <div id="bulk-list-box" class="form-group" style="display: none;">
          <label>URL Halaman Daftar Manga</label>
          <div style="display: flex; gap: 0.5rem;">
            <input type="text" id="listPageUrl" placeholder="Contoh: https://01.apkomik.com/manhwa-terbaru">
            <button onclick="fetchMangaList()" style="width: auto; whiteSpace: nowrap;">Ambil Daftar</button>
          </div>
          <div id="manga-list-container" style="margin-top: 1rem;"></div>
        </div>

        <div class="form-group" style="margin-top: 1rem;">
          <label>Mode Chapter yang Ingin Discrap:</label>
          <select id="bulk-chapter-mode">
            <option value="all">Semua Chapter yang Ada</option>
            <option value="latest">Hanya Chapter Terbaru (1)</option>
          </select>
        </div>

        <div style="margin-top: 1.5rem;">
          <button id="btn-start-bulk" onclick="runBulkScraping()" style="background: var(--success);">Start Bulk Scraping & Upload</button>
        </div>
      </div>

      <!-- TERMINAL LOG -->
      <div id="terminal-log" class="terminal-log" style="display: none;">
        <div id="log-contents"></div>
      </div>
    </div>
  </div>

  <script>
    var currentMode = 'single';
    var currentMangaDetail = null;
    var fetchedMangaList = [];
    var selectedMangas = [];

    document.addEventListener('DOMContentLoaded', function() {
      var cronEl = document.getElementById('cron-url');
      if (cronEl) cronEl.value = window.location.origin + '/?page=https://01.apkomik.com/manhwa-terbaru';
    });

    window.copyCronUrl = function() {
      var el = document.getElementById('cron-url');
      el.select();
      navigator.clipboard.writeText(el.value);
      alert('Cron Trigger URL berhasil di-copy!');
    };

    window.switchMode = function(mode) {
      currentMode = mode;
      document.getElementById('tab-single').className = mode === 'single' ? 'tab-btn active' : 'tab-btn';
      document.getElementById('tab-bulk').className = mode === 'bulk' ? 'tab-btn active' : 'tab-btn';
      document.getElementById('mode-single-section').style.display = mode === 'single' ? 'block' : 'none';
      document.getElementById('mode-bulk-section').style.display = mode === 'bulk' ? 'block' : 'none';
    };

    window.switchBulkType = function(type) {
      document.getElementById('bulk-manual-box').style.display = type === 'manual' ? 'flex' : 'none';
      document.getElementById('bulk-list-box').style.display = type === 'list' ? 'flex' : 'none';
    };

    window.log = function(type, text) {
      var term = document.getElementById('terminal-log');
      var contents = document.getElementById('log-contents');
      term.style.display = 'block';
      var p = document.createElement('p');
      p.className = type;
      p.textContent = text;
      contents.appendChild(p);
      term.scrollTop = term.scrollHeight;
    };

    window.fetchPreview = async function() {
      var val = document.getElementById('urlOrSlug').value.trim();
      if (!val) return alert('Masukkan URL atau slug komik!');

      var slug = val.split('/manga/').pop().replace(/\\/$/, '');
      var btn = document.getElementById('btn-preview');
      btn.disabled = true;
      btn.innerHTML = 'Mengambil Data...';

      try {
        var res = await fetch('/api/preview?slug=' + encodeURIComponent(slug));
        var data = await res.json();
        btn.disabled = false;
        btn.innerHTML = 'Preview Manga';

        if (!res.ok) return alert('Error: ' + data.error);

        currentMangaDetail = data.detail;
        renderPreviewCard(data.detail);
      } catch (e) {
        btn.disabled = false;
        btn.innerHTML = 'Preview Manga';
        alert('Error: ' + e.message);
      }
    };

    window.renderPreviewCard = function(detail) {
      var box = document.getElementById('preview-container');
      window.selectedSingleChapters = [...detail.chapters];

      box.innerHTML = \`
        <div class="preview-card">
          <img src="\${detail.coverImage || ''}" alt="\${detail.title}">
          <div class="preview-info">
            <h2>\${detail.title}</h2>
            <p><strong>Total Chapter:</strong> \${detail.chapters.length}</p>
            <p>\${detail.synopsis || 'Tidak ada sinopsis'}</p>
          </div>
        </div>

        <div class="chapter-selection" style="margin-top: 1.5rem;">
          <div class="form-group">
            <label>Mode Pilihan Chapter:</label>
            <select id="single-chapter-mode" onchange="handleSingleChapterMode(this.value)">
              <option value="all">Semua Chapter (\${detail.chapters.length})</option>
              <option value="latest">Hanya Chapter Terbaru (1)</option>
              <option value="manual">Pilih Chapter Manual (Checkbox)</option>
            </select>
          </div>

          <div id="single-manual-chapter-box" style="display: none; margin-top: 1rem;">
            <div style="margin-bottom: 0.8rem; display: flex; gap: 0.5rem;">
              <button type="button" onclick="selectAllSingleChapters()" class="tab-btn" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; width: auto; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);">
                Pilih Semua
              </button>
              <button type="button" onclick="unselectAllSingleChapters()" class="tab-btn" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; width: auto; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);">
                Hapus Semua
              </button>
            </div>
            <div id="single-chapter-checkbox-list" class="chapter-list">
              \${detail.chapters.map(ch => \`
                <label class="chapter-item">
                  <input type="checkbox" checked onchange="toggleSingleChapter('\${ch.slug}')" style="width:auto; margin:0;">
                  \${ch.title}
                </label>
              \`).join('')}
            </div>
          </div>
        </div>

        <div style="margin-top: 1.5rem;">
          <button id="btn-start-single" onclick="startSingleScraping()" style="background: var(--success);">
            Start Scraping & Upload (\${detail.chapters.length} Chapter)
          </button>
        </div>
      \`;
    };

    window.handleSingleChapterMode = function(mode) {
      var manualBox = document.getElementById('single-manual-chapter-box');
      if (!currentMangaDetail) return;

      if (mode === 'all') {
        manualBox.style.display = 'none';
        window.selectedSingleChapters = [...currentMangaDetail.chapters];
      } else if (mode === 'latest') {
        manualBox.style.display = 'none';
        window.selectedSingleChapters = currentMangaDetail.chapters.length ? [currentMangaDetail.chapters[0]] : [];
      } else {
        manualBox.style.display = 'block';
      }
      updateSingleStartButton();
    };

    window.selectAllSingleChapters = function() {
      if (!currentMangaDetail) return;
      window.selectedSingleChapters = [...currentMangaDetail.chapters];
      renderSingleChapterCheckboxes();
      updateSingleStartButton();
    };

    window.unselectAllSingleChapters = function() {
      window.selectedSingleChapters = [];
      renderSingleChapterCheckboxes();
      updateSingleStartButton();
    };

    window.toggleSingleChapter = function(slug) {
      if (!currentMangaDetail) return;
      var idx = window.selectedSingleChapters.findIndex(c => c.slug === slug);
      if (idx > -1) window.selectedSingleChapters.splice(idx, 1);
      else {
        var found = currentMangaDetail.chapters.find(c => c.slug === slug);
        if (found) window.selectedSingleChapters.push(found);
      }
      updateSingleStartButton();
    };

    function renderSingleChapterCheckboxes() {
      if (!currentMangaDetail) return;
      var listEl = document.getElementById('single-chapter-checkbox-list');
      if (!listEl) return;
      listEl.innerHTML = currentMangaDetail.chapters.map(ch => {
        var isChecked = window.selectedSingleChapters.some(c => c.slug === ch.slug);
        return \`
          <label class="chapter-item">
            <input type="checkbox" \${isChecked ? 'checked' : ''} onchange="toggleSingleChapter('\${ch.slug}')" style="width:auto; margin:0;">
            \${ch.title}
          </label>
        \`;
      }).join('');
    }

    function updateSingleStartButton() {
      var btn = document.getElementById('btn-start-single');
      if (btn) {
        var count = window.selectedSingleChapters ? window.selectedSingleChapters.length : 0;
        btn.innerText = \`Start Scraping & Upload (\${count} Chapter)\`;
        btn.disabled = count === 0;
      }
    }

    window.fetchMangaList = async function() {
      var url = document.getElementById('listPageUrl').value.trim();
      if (!url) return alert('Masukkan URL Halaman Daftar Manga!');

      try {
        var res = await fetch('/api/list?url=' + encodeURIComponent(url));
        var data = await res.json();
        if (res.ok && data.success) {
          fetchedMangaList = data.list;
          selectedMangas = [...data.list];
          renderMangaList();
        } else {
          alert('Error: ' + data.error);
        }
      } catch (e) {
        alert('Gagal mengambil daftar: ' + e.message);
      }
    };

    window.renderMangaList = function() {
      var box = document.getElementById('manga-list-container');
      box.innerHTML = \`
        <div class="chapter-selection">
          <label>Pilih Manga (\${selectedMangas.length} terpilih)</label>
          <div style="margin-top: 0.5rem; margin-bottom: 0.8rem; display: flex; gap: 0.5rem;">
            <button type="button" onclick="selectAllMangas()" class="tab-btn" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; width: auto; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);">
              Pilih Semua
            </button>
            <button type="button" onclick="unselectAllMangas()" class="tab-btn" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; width: auto; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);">
              Hapus Semua
            </button>
          </div>
          <div class="chapter-list">
            \${fetchedMangaList.map(m => {
              var isChecked = selectedMangas.some(x => x.slug === m.slug);
              return \`
                <label class="chapter-item">
                  <input type="checkbox" \${isChecked ? 'checked' : ''} onchange="toggleMangaSelection('\${m.slug}')" style="width:auto; margin:0;">
                  \${m.title} <span style="color:#8b949e; font-size:0.8rem;">(\${m.slug})</span>
                </label>
              \`;
            }).join('')}
          </div>
        </div>
      \`;
    };

    window.selectAllMangas = function() {
      selectedMangas = [...fetchedMangaList];
      renderMangaList();
    };

    window.unselectAllMangas = function() {
      selectedMangas = [];
      renderMangaList();
    };

    window.toggleMangaSelection = function(slug) {
      var idx = selectedMangas.findIndex(m => m.slug === slug);
      if (idx > -1) selectedMangas.splice(idx, 1);
      else {
        var found = fetchedMangaList.find(m => m.slug === slug);
        if (found) selectedMangas.push(found);
      }
      renderMangaList();
    };

    window.startSingleScraping = function() {
      if (!currentMangaDetail) return;
      var targetUrl = \`https://01.apkomik.com/manga/\${currentMangaDetail.slug}/\`;
      var selectedSlugs = window.selectedSingleChapters ? window.selectedSingleChapters.map(c => c.slug) : [];
      startProcessStream(targetUrl, { chapters: selectedSlugs });
    };

    window.runBulkScraping = function() {
      var type = document.getElementById('bulk-type-select').value;
      var chMode = document.getElementById('bulk-chapter-mode') ? document.getElementById('bulk-chapter-mode').value : 'all';

      if (type === 'manual') {
        var text = document.getElementById('bulkInput').value.trim();
        if (!text) return alert('Masukkan daftar URL / slug terlebih dahulu!');
        var lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
        var firstLine = lines[0];
        var targetUrl = firstLine.startsWith('http') ? firstLine : \`https://01.apkomik.com/manga/\${firstLine}/\`;
        startProcessStream(targetUrl, { chapterMode: chMode });
      } else {
        if (!selectedMangas || selectedMangas.length === 0) return alert('Pilih/centang minimal 1 manga!');
        var pageUrl = document.getElementById('listPageUrl').value.trim() || 'https://01.apkomik.com/manhwa-terbaru';
        var mangaSlugs = selectedMangas.map(m => m.slug);
        startProcessStream(pageUrl, { chapterMode: chMode, mangas: mangaSlugs });
      }
    };

    window.startProcessStream = function(targetPageUrl, params) {
      params = params || {};
      var term = document.getElementById('terminal-log');
      var contents = document.getElementById('log-contents');
      term.style.display = 'block';
      contents.innerHTML = '';

      log('info', \`🚀 Memulai proses scraping untuk \${targetPageUrl}...\`);

      var streamUrl = \`/?page=\${encodeURIComponent(targetPageUrl)}&stream=1\`;
      if (params.chapterMode) streamUrl += \`&chapterMode=\${encodeURIComponent(params.chapterMode)}\`;
      if (params.chapters) streamUrl += \`&chapters=\${encodeURIComponent(JSON.stringify(params.chapters))}\`;
      if (params.mangas) streamUrl += \`&mangas=\${encodeURIComponent(JSON.stringify(params.mangas))}\`;

      var eventSource = new EventSource(streamUrl);

      eventSource.onmessage = function(event) {
        if (event.data === '[DONE]') {
          eventSource.close();
          log('success', '✨ [PROCESS FINISHED] Semua task berhasil diselesaikan.');
          return;
        }
        
        var type = 'normal';
        if (event.data.includes('[SUCCESS]') || event.data.includes('[OK]')) type = 'success';
        else if (event.data.includes('[SKIP]')) type = 'info';
        else if (event.data.includes('[ERROR]')) type = 'error';
        
        log(type, event.data);
      };

      eventSource.onerror = function() {
        eventSource.close();
        log('error', '⚠️ Koneksi terputus atau selesai.');
      };
    };
  </script>
</body>
</html>`;
}

export default {
  // HTTP Fetch Event
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pageUrl = url.searchParams.get('page');
    const isStream = url.searchParams.get('stream') === '1';

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Endpoint API preview untuk UI Manual Scrape
    if (url.pathname === '/api/preview') {
      const slug = url.searchParams.get('slug');
      if (!slug) {
        return new Response(JSON.stringify({ error: 'Slug required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      try {
        const detail = await scrapeApkomikDetail(slug);
        return new Response(JSON.stringify({ success: true, detail }), { headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Endpoint API list manga untuk UI Bulk List Scrape
    if (url.pathname === '/api/list') {
      const targetUrl = url.searchParams.get('url') || 'https://01.apkomik.com/manhwa-terbaru';
      try {
        const list = await scrapeApkomikList(targetUrl);
        return new Response(JSON.stringify({ success: true, list }), { headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Jika tidak ada query parameter ?page=, TAMPILKAN EXACT UI DASHBOARD SAMA PERSIS SEPERTI App.jsx
    if (!pageUrl && !isStream) {
      return new Response(getExactUiAppHtml(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Target URL ditentukan via parameter ?page=
    const targetPageUrl = pageUrl || 'https://01.apkomik.com/manhwa-terbaru';

    const chapterModeParam = url.searchParams.get('chapterMode') || 'all'; // 'all' | 'latest'
    const chaptersParam = url.searchParams.get('chapters'); // optional json list of chapter slugs
    const mangasParam = url.searchParams.get('mangas'); // optional json list of manga slugs selected

    // Jika dipanggil via browser dengan ?page=, alirkan real-time log SSE stream
    const acceptHeader = request.headers.get('Accept') || '';
    if (acceptHeader.includes('text/html') || isStream) {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      const log = async (msg) => {
        console.log(msg);
        await writer.write(encoder.encode(`data: ${msg}\n\n`));
      };

      ctx.waitUntil(
        (async () => {
          try {
            await log(`[START] Memulai Auto Scrap untuk ${targetPageUrl}`);
            let mangaList = await scrapeApkomikList(targetPageUrl);

            // Filter HANYA manga yang DI-CEKLIS oleh user
            if (mangasParam) {
              try {
                const selectedMangaSlugs = new Set(JSON.parse(mangasParam));
                mangaList = mangaList.filter(m => selectedMangaSlugs.has(m.slug));
              } catch (e) {}
            }

            await log(`[LIST] Ditemukan ${mangaList.length} manga terpilih yang akan diproses.`);

            let selectedSingleChapterSlugs = null;
            if (chaptersParam) {
              try {
                selectedSingleChapterSlugs = new Set(JSON.parse(chaptersParam));
              } catch (e) {}
            }

            for (let i = 0; i < mangaList.length; i++) {
              const item = mangaList[i];
              try {
                const detail = await scrapeApkomikDetail(item.slug);
                if (!detail.chapters || detail.chapters.length === 0) continue;

                let chaptersToProcess = detail.chapters;
                if (selectedSingleChapterSlugs) {
                  chaptersToProcess = detail.chapters.filter(ch => selectedSingleChapterSlugs.has(ch.slug));
                } else if (chapterModeParam === 'latest') {
                  chaptersToProcess = [detail.chapters[0]];
                }

                for (let c = 0; c < chaptersToProcess.length; c++) {
                  const ch = chaptersToProcess[c];
                  const localSlug = ch.slug.startsWith(`${detail.slug}-`) ? ch.slug : `${detail.slug}-${ch.slug}`;

                  // KONDISI SKIP CHAPTER JIKA SUDAH ADA DI DB (TIDAK MENIMPA!)
                  const exists = await checkChapterExistsInBackend(env.KOMIKNESIA_API_URL, localSlug);
                  if (exists) {
                    await log(`[SKIP] ${detail.slug} - ${ch.title} sudah ada di DB. SKIPPED.`);
                    continue;
                  }

                  await log(`\n[NEW] Processing ${detail.slug} (${ch.title})...`);

                  const images = await scrapeApkomikChapterImages(ch.url);
                  await log(`[IMAGES] Ditemukan ${images.length} halaman gambar. Uploading ke R2...`);

                  const r2Images = [];
                  let failedCount = 0;

                  for (let j = 0; j < images.length; j++) {
                    const ext = images[j].split('?')[0].split('.').pop() || 'webp';
                    const key = `komiknesia/apkomik/chapters/${detail.slug}/${ch.slug}/pages/${j + 1}.${ext}`;
                    try {
                      const r2Url = await uploadImageToR2(env, key, images[j], ch.url);
                      r2Images.push(r2Url);
                      await log(`  [R2 OK] Page ${j + 1}/${images.length} -> ${r2Url}`);
                    } catch (err) {
                      failedCount++;
                      await log(`  [R2 ERROR] Page ${j + 1}/${images.length} GAGAL UPLOAD R2 (${err.message}) | URL: ${images[j]} | Ref: ${ch.url}. SKIPPING.`);
                    }
                  }

                  if (r2Images.length === 0) {
                    await log(`[ERROR] SEMUA GAMBAR GAGAL DIUPLOAD KE R2 DENGAN SEMPURNA! Batalkan Sync ke DB agar tidak menyimpan URL hotlink.`);
                    continue;
                  }

                  if (failedCount > 0) {
                    await log(`[WARNING] Sebagian gambar (${failedCount}/${images.length}) gagal upload R2. Hanya ${r2Images.length} gambar R2 yang dikirim ke DB.`);
                  }

                  // Sync Payload to Backend
                  const payload = {
                    source: 'apkomik',
                    mangaDetail: {
                      title: detail.title,
                      slug: detail.slug,
                      synopsis: detail.synopsis,
                      coverImage: detail.coverImage,
                      genres: detail.genres,
                    },
                    chapters: [{
                      slug: ch.slug,
                      title: ch.title,
                      chapterNumber: ch.chapterNumber,
                      images: r2Images,
                    }],
                  };

                  const syncRes = await fetch(env.KOMIKNESIA_API_URL, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${env.KOMIKNESIA_API_SECRET}`,
                    },
                    body: JSON.stringify(payload),
                  });

                  const syncData = await syncRes.json();
                  await log(`[SUCCESS] Chapter ${ch.title} disinkronkan ke DB backend. Result: ${JSON.stringify(syncData)}`);
                }

              } catch (err) {
                await log(`[ERROR] Error processing ${item.slug}: ${err.message}`);
              }
            }
          } catch (e) {
            await log(`[FATAL ERROR] ${e.message}`);
          } finally {
            await log('[DONE]');
            await writer.close();
          }
        })()
      );

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Default JSON response jika dipanggil via API / Curl / Postman
    try {
      const summary = await processAutoScrap(env, targetPageUrl);
      return new Response(JSON.stringify({ success: true, count: summary.length, summary }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  },

  // Cron Trigger Scheduled Event (Jalan 1 Jam sekali)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processAutoScrap(env, 'https://01.apkomik.com/manga-terbaru'));
  },
};
