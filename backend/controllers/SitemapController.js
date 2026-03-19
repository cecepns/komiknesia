const db = require('../db');

const SITE_URL = 'https://komiknesia.net';
const API_URL = 'https://be-api.komiknesia.net';

// NOTE: We reuse the in-memory cache from server via getCache/setCache signatures,
// but since this controller is standalone, it keeps its own lightweight cache here.
// If you want a single shared cache, you can later extract this to a shared utils module.
const memoryCache = new Map();

const setCache = (key, data, ttlMs) => {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
};

const getCache = (key) => {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
};

const robots = (req, res) => {
  const robotsTxt = `# robots.txt for KomikNesia API
# ${API_URL}

User-agent: *
Allow: /sitemap.xml
Allow: /sitemap-index.xml
Allow: /sitemap-manga.xml
Allow: /sitemap-chapters.xml

# Sitemap locations
Sitemap: ${API_URL}/sitemap.xml
Sitemap: ${API_URL}/sitemap-index.xml
`;

  res.set('Content-Type', 'text/plain');
  res.send(robotsTxt);
};

const sitemapMain = async (req, res) => {
  try {
    const cacheKey = 'sitemap:main';
    const cached = getCache(cacheKey);
    if (cached) {
      res.set('Content-Type', 'application/xml');
      return res.send(cached);
    }

    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/content', priority: '0.9', changefreq: 'daily' },
      { url: '/library', priority: '0.8', changefreq: 'daily' },
      { url: '/contact', priority: '0.5', changefreq: 'monthly' },
    ];

    const [mangaRows] = await db.execute(`
      SELECT slug, updated_at 
      FROM manga 
      WHERE slug IS NOT NULL AND slug != ''
      ORDER BY updated_at DESC
    `);

    const [chapterRows] = await db.execute(`
      SELECT c.slug, c.updated_at
      FROM chapters c
      WHERE c.slug IS NOT NULL AND c.slug != ''
      ORDER BY c.updated_at DESC
    `);

    const now = new Date().toISOString().split('T')[0];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    for (const page of staticPages) {
      xml += '  <url>\n';
      xml += `    <loc>${SITE_URL}${page.url}</loc>\n`;
      xml += `    <lastmod>${now}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    }

    for (const manga of mangaRows) {
      const lastmod = manga.updated_at
        ? new Date(manga.updated_at).toISOString().split('T')[0]
        : now;

      xml += '  <url>\n';
      xml += `    <loc>${SITE_URL}/komik/${encodeURIComponent(manga.slug)}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    }

    for (const chapter of chapterRows) {
      const lastmod = chapter.updated_at
        ? new Date(chapter.updated_at).toISOString().split('T')[0]
        : now;

      xml += '  <url>\n';
      xml += `    <loc>${SITE_URL}/view/${encodeURIComponent(chapter.slug)}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '    <changefreq>monthly</changefreq>\n';
      xml += '    <priority>0.6</priority>\n';
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.send(xml);

    setCache(cacheKey, xml, 60 * 1000);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res
      .status(500)
      .send(
        '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
      );
  }
};

const sitemapIndex = async (req, res) => {
  try {
    const now = new Date().toISOString().split('T')[0];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    xml += '  <sitemap>\n';
    xml += `    <loc>${SITE_URL}/sitemap.xml</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += '  </sitemap>\n';

    xml += '  <sitemap>\n';
    xml += `    <loc>${SITE_URL}/sitemap-manga.xml</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += '  </sitemap>\n';

    xml += '  <sitemap>\n';
    xml += `    <loc>${SITE_URL}/sitemap-chapters.xml</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += '  </sitemap>\n';

    xml += '</sitemapindex>';

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generating sitemap index:', error);
    res
      .status(500)
      .send(
        '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>'
      );
  }
};

const sitemapManga = async (req, res) => {
  try {
    const cacheKey = 'sitemap:manga';
    const cached = getCache(cacheKey);
    if (cached) {
      res.set('Content-Type', 'application/xml');
      return res.send(cached);
    }

    const [mangaRows] = await db.execute(`
      SELECT slug, updated_at 
      FROM manga 
      WHERE slug IS NOT NULL AND slug != ''
      ORDER BY updated_at DESC
    `);

    const now = new Date().toISOString().split('T')[0];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    for (const manga of mangaRows) {
      const lastmod = manga.updated_at
        ? new Date(manga.updated_at).toISOString().split('T')[0]
        : now;

      xml += '  <url>\n';
      xml += `    <loc>${SITE_URL}/komik/${encodeURIComponent(manga.slug)}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.send(xml);

    setCache(cacheKey, xml, 60 * 1000);
  } catch (error) {
    console.error('Error generating manga sitemap:', error);
    res
      .status(500)
      .send(
        '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
      );
  }
};

const sitemapChapters = async (req, res) => {
  try {
    const cacheKey = 'sitemap:chapters';
    const cached = getCache(cacheKey);
    if (cached) {
      res.set('Content-Type', 'application/xml');
      return res.send(cached);
    }

    const [chapterRows] = await db.execute(`
      SELECT c.slug, c.updated_at
      FROM chapters c
      WHERE c.slug IS NOT NULL AND c.slug != ''
      ORDER BY c.updated_at DESC
    `);

    const now = new Date().toISOString().split('T')[0];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    for (const chapter of chapterRows) {
      const lastmod = chapter.updated_at
        ? new Date(chapter.updated_at).toISOString().split('T')[0]
        : now;

      xml += '  <url>\n';
      xml += `    <loc>${SITE_URL}/view/${encodeURIComponent(chapter.slug)}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '    <changefreq>monthly</changefreq>\n';
      xml += '    <priority>0.6</priority>\n';
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.send(xml);

    setCache(cacheKey, xml, 60 * 1000);
  } catch (error) {
    console.error('Error generating chapters sitemap:', error);
    res
      .status(500)
      .send(
        '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
      );
  }
};

const sitemapStats = async (req, res) => {
  try {
    const [mangaCount] = await db.execute(`
      SELECT COUNT(*) as count FROM manga WHERE slug IS NOT NULL AND slug != ''
    `);

    const [chapterCount] = await db.execute(`
      SELECT COUNT(*) as count FROM chapters WHERE slug IS NOT NULL AND slug != ''
    `);

    res.json({
      status: true,
      data: {
        static_pages: 4,
        manga_pages: mangaCount[0].count,
        chapter_pages: chapterCount[0].count,
        total_urls: 4 + mangaCount[0].count + chapterCount[0].count,
      },
    });
  } catch (error) {
    console.error('Error getting sitemap stats:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = {
  robots,
  sitemapMain,
  sitemapIndex,
  sitemapManga,
  sitemapChapters,
  sitemapStats,
};

