/* eslint-disable no-undef */
/* eslint-env node */
const { ikiruFetchHtml } = require('../utils/ikiruSession');

const BASE_URL = 'https://02.ikiru.wtf';

function cleanText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

async function fetchHtml(url) {
  try {
    return await ikiruFetchHtml(url, { timeout: 15000 });
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    throw new Error('Gagal mengambil data dari sumber');
  }
}

async function scrapeChaptersFromMangaPage(mangaDoc) {
  const chapters = [];
  const $ = mangaDoc;

  const chapterListEl = $('#chapter-list');

  if (chapterListEl && chapterListEl.length) {
    const rawHxGet =
      chapterListEl.attr('hx-get') ||
      chapterListEl.attr('data-hx-get') ||
      chapterListEl.attr('data-hxGet') ||
      chapterListEl.attr('hxGet');

    let chapterDoc = null;

    try {
      if (rawHxGet) {
        const hxGet = rawHxGet.trim();
        let chapterListUrl;

        if (hxGet.startsWith('http')) {
          chapterListUrl = hxGet;
        } else if (hxGet.startsWith('//')) {
          chapterListUrl = 'https:' + hxGet;
        } else if (hxGet.startsWith('/')) {
          chapterListUrl = BASE_URL + hxGet;
        } else {
          chapterListUrl = `${BASE_URL}/${hxGet}`;
        }

        chapterDoc = await fetchHtml(chapterListUrl);
      } else {
        chapterDoc = $;
      }
    } catch (e) {
      console.error('Error fetching HTMX chapter list:', e.message);
    }

    if (chapterDoc) {
      const $$ = chapterDoc;

      $$('#chapter-list [data-chapter-number], [data-chapter-number]').each(
        (_, el) => {
          const row = $$(el);
          const dataNumber = row.attr('data-chapter-number');
          const linkEl = row.find('a[href*="/chapter-"]').first();

          const href = linkEl.attr('href') || '';
          if (!href || !href.includes('/chapter-')) return;

          const text = cleanText(linkEl.text());
          const fullUrl = href.startsWith('http') ? href : BASE_URL + href;
          const chapterSlug = href.split('/').filter(Boolean).pop();

          let chapterNumber = null;
          if (dataNumber && !Number.isNaN(Number(dataNumber))) {
            chapterNumber = Number(dataNumber);
          } else {
            const numMatch =
              chapterSlug.match(/chapter-([\d.]+)/i) ||
              text.match(/chapter\s+([\d.]+)/i);
            if (numMatch) {
              chapterNumber = parseFloat(numMatch[1]);
            }
          }

          chapters.push({
            title: text || chapterSlug,
            url: fullUrl,
            slug: chapterSlug,
            chapterNumber,
          });
        }
      );
    }
  }

  return chapters;
}

async function fetchChaptersForMangaSlug(slug) {
  const mangaUrl = `${BASE_URL}/manga/${slug}/`;
  const $ = await fetchHtml(mangaUrl);
  return scrapeChaptersFromMangaPage($);
}

async function attachChaptersToMangas(mangas, { chaptersLimit, concurrency }) {
  const effectiveConcurrency = Math.max(
    1,
    Math.min(concurrency || 3, mangas.length || 1)
  );

  let idx = 0;
  async function worker() {
    while (idx < mangas.length) {
      const currentIdx = idx;
      idx += 1;

      const item = mangas[currentIdx];
      try {
        const chapters = await fetchChaptersForMangaSlug(item.slug);
        const sliced =
          chaptersLimit === null || chaptersLimit === undefined
            ? chapters
            : chapters.slice(0, chaptersLimit);

        item.chapters = sliced;
        item.chaptersCount = sliced.length;
      } catch (e) {
        console.error(`Error attachChapters for slug=${item.slug}:`, e.message);
        item.chapters = [];
        item.chaptersCount = 0;
      }
    }
  }

  await Promise.all(
    Array.from({ length: effectiveConcurrency }, worker)
  );
  return mangas;
}

async function getProjectUpdates(req, res) {
  try {
    const $ = await fetchHtml(BASE_URL + '/');

    const sectionHeader = $('h2, h3')
      .filter((_, el) => cleanText($(el).text()).toLowerCase() === 'project updates')
      .first();

    let cardsContainer;
    if (sectionHeader.length) {
      cardsContainer = sectionHeader.parent();
    } else {
      cardsContainer = $('section')
        .filter((_, el) => $(el).text().toLowerCase().includes('project updates'))
        .first();
    }

    const mangas = [];

    if (cardsContainer && cardsContainer.length) {
      cardsContainer
        .find('a')
        .filter((_, el) => {
          const href = $(el).attr('href') || '';
          return href.includes('/manga/') && $(el).find('img').length > 0;
        })
        .each((_, el) => {
          const link = $(el);
          const href = link.attr('href');
          if (!href) return;

          const fullHref = href.startsWith('http') ? href : BASE_URL + href;
          const slug = href
            .replace(BASE_URL, '')
            .replace(/^\/manga\//, '')
            .replace(/\/$/, '');

          let title = cleanText(link.text());
          if (!title) {
            const siblingTitleLink = link
              .parent()
              .siblings()
              .find(`a[href="${href}"]`)
              .first();
            if (siblingTitleLink && siblingTitleLink.length) {
              title = cleanText(siblingTitleLink.text());
            }
          }
          if (!title) {
            title = slug.replace(/-/g, ' ');
          }

          let img =
            link.find('img').first() ||
            link.closest('article, .card, .item, .series, div').find('img').first();

          let coverImage = null;
          if (img && img.length) {
            let src = img.attr('data-src') || img.attr('src');
            if (src) {
              if (src.startsWith('//')) src = 'https:' + src;
              else if (src.startsWith('/')) src = BASE_URL + src;
              coverImage = src;
            }
          }

          mangas.push({
            title,
            url: fullHref,
            slug,
            coverImage,
          });
        });
    }

    const includeChaptersDefault = req.query.includeChapters ?? req.query.withChapters;
    const includeChapters =
      includeChaptersDefault === undefined
        ? true
        : includeChaptersDefault === 'true';

    if (includeChapters && mangas.length) {
      const rawLimit = req.query.chaptersLimit;
      const chaptersLimit =
        rawLimit === undefined
          ? 10
          : rawLimit === 'all' || rawLimit === '0'
            ? null
            : Number.isNaN(parseInt(rawLimit, 10))
              ? 10
              : parseInt(rawLimit, 10);

      await attachChaptersToMangas(mangas, {
        chaptersLimit,
        concurrency: 3,
      });
    }

    res.json({
      source: BASE_URL,
      section: 'Project Updates',
      page: 1,
      count: mangas.length,
      data: mangas,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Terjadi kesalahan internal' });
  }
}

async function getLatestUpdates(req, res) {
  try {
    const $ = await fetchHtml(`${BASE_URL}/latest-update/`);

    const mangaMap = new Map();

    $('a[href*="/manga/"]').each((_, el) => {
      const link = $(el);
      const href = link.attr('href') || '';
      if (!href.includes('/manga/')) return;
      if (href.includes('/chapter-')) return;

      const fullHref = href.startsWith('http') ? href : BASE_URL + href;
      const slug = href
        .replace(BASE_URL, '')
        .replace(/^\/manga\//, '')
        .replace(/\/$/, '');
      if (!slug) return;

      let title = cleanText(link.text());

      const img =
        link.find('img').first() ||
        link.closest('article, .card, .item, .series, div, li, section').find('img').first();

      if (!title && img && img.length) {
        title = cleanText(img.attr('alt') || '');
      }

      if (!title) {
        const titleEl = link
          .closest('article, .card, .item, .series, div, li, section')
          .find('h1, h2, h3, h4, .title, .name')
          .first();
        title = cleanText(titleEl.text());
      }

      if (!title) title = slug.replace(/-/g, ' ');

      let coverImage = null;
      if (img && img.length) {
        let src = img.attr('data-src') || img.attr('src');
        if (src) {
          if (src.startsWith('//')) src = 'https:' + src;
          else if (src.startsWith('/')) src = BASE_URL + src;
          coverImage = src;
        }
      }

      if (!mangaMap.has(slug)) {
        mangaMap.set(slug, {
          title,
          url: fullHref,
          slug,
          coverImage,
        });
      } else {
        const existing = mangaMap.get(slug);
        if (!existing.coverImage && coverImage) existing.coverImage = coverImage;
        if ((!existing.title || existing.title === slug.replace(/-/g, ' ')) && title) {
          existing.title = title;
        }
      }
    });

    const mangas = Array.from(mangaMap.values());

    const includeChaptersDefault = req.query.includeChapters ?? req.query.withChapters;
    const includeChapters =
      includeChaptersDefault === undefined
        ? true
        : includeChaptersDefault === 'true';

    if (includeChapters && mangas.length) {
      const rawLimit = req.query.chaptersLimit;
      const chaptersLimit =
        rawLimit === undefined
          ? 10
          : rawLimit === 'all' || rawLimit === '0'
            ? null
            : Number.isNaN(parseInt(rawLimit, 10))
              ? 10
              : parseInt(rawLimit, 10);

      await attachChaptersToMangas(mangas, {
        chaptersLimit,
        concurrency: 3,
      });
    }

    res.json({
      source: BASE_URL,
      section: 'Latest Updates',
      page: 1,
      count: mangas.length,
      data: mangas,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Terjadi kesalahan internal' });
  }
}

async function getMangaDetail(req, res) {
  const { slug } = req.params;
  const mangaUrl = `${BASE_URL}/manga/${slug}/`;

  try {
    const $ = await fetchHtml(mangaUrl);

    let coverImage = null;
    let coverImgEl = $('div[itemprop="image"] img').first();

    if (!coverImgEl || !coverImgEl.length) {
      const slugTitle = slug.replace(/-/g, ' ').toLowerCase();
      coverImgEl =
        $('img')
          .filter((_, el) => {
            const alt = ($(el).attr('alt') || '').toLowerCase();
            const cls = ($(el).attr('class') || '').toLowerCase();
            return (
              alt.includes(slugTitle) ||
              alt.includes('cover') ||
              cls.includes('cover') ||
              cls.includes('poster')
            );
          })
          .first() || $('main img').first();
    }

    if (coverImgEl && coverImgEl.length) {
      let src = coverImgEl.attr('data-src') || coverImgEl.attr('src');
      if (src) {
        if (src.startsWith('//')) src = 'https:' + src;
        else if (src.startsWith('/')) src = BASE_URL + src;
        coverImage = src;
      }
    }

    const title =
      cleanText($('h1').first().text()) ||
      cleanText($('h2').first().text()) ||
      slug.replace(/-/g, ' ');

    const info = {};
    $('div, section')
      .filter((_, el) => {
        const txt = $(el).text().toLowerCase();
        return (
          txt.includes('released') ||
          txt.includes('total views') ||
          txt.includes('serialization') ||
          txt.includes('type') ||
          txt.includes('last updates')
        );
      })
      .first()
      .find('li, p, span')
      .each((_, el) => {
        const text = cleanText($(el).text());
        const lower = text.toLowerCase();

        if (lower.includes('released')) info.released = text.replace(/released/i, '').trim();
        else if (lower.includes('serialization'))
          info.serialization = text.replace(/serialization/i, '').trim();
        else if (lower.includes('total views'))
          info.totalViews = text.replace(/total views/i, '').trim();
        else if (lower.includes('type')) info.type = text.replace(/type/i, '').trim();
        else if (lower.includes('last updates'))
          info.lastUpdates = text.replace(/last updates/i, '').trim();
      });

    let rating = null;
    let favorites = null;
    $('*')
      .filter((_, el) => {
        const txt = $(el).text();
        return /\d+(\.\d+)?\s*Ratings?/i.test(txt) || /\d+\s*Favorites?/i.test(txt);
      })
      .each((_, el) => {
        const text = cleanText($(el).text());
        const matchRating = text.match(/(\d+(\.\d+)?)\s*Ratings?/i);
        const matchFav = text.match(/(\d+)\s*Favorites?/i);
        if (matchRating) rating = parseFloat(matchRating[1]);
        if (matchFav) favorites = parseInt(matchFav[1], 10);
      });

    let synopsis = '';
    let genres = [];

    const synopsisHeader = $('h3, h4')
      .filter((_, el) => cleanText($(el).text()).toLowerCase() === 'synopsis')
      .first();

    if (synopsisHeader.length) {
      const synopsisContainer = synopsisHeader.parent();
      synopsis = cleanText(synopsisContainer.text().replace(/Synopsis/i, ''));
    } else {
      const maybeSynopsis = $('p')
        .filter((_, el) => {
          const txt = $(el).text().toLowerCase();
          return txt.includes('dikhianati') || txt.includes('sinopsis') || txt.length > 100;
        })
        .first();
      synopsis = cleanText(maybeSynopsis.text());
    }

    const genreSet = new Set();
    $('a, span, button')
      .filter((_, el) => {
        const txt = cleanText($(el).text());
        return /action|adventure|fantasy|drama|comedy|romance|isekai|shounen|seinen|slice of life|supernatural|school life/i.test(
          txt
        );
      })
      .each((_, el) => {
        const txt = cleanText($(el).text());
        txt
          .split(/[\s/,-]+/)
          .map((g) => g.trim())
          .filter(Boolean)
          .forEach((g) => genreSet.add(g));
      });
    genres = Array.from(genreSet);

    const chapters = await scrapeChaptersFromMangaPage($);

    res.json({
      source: BASE_URL,
      url: mangaUrl,
      slug,
      title,
      coverImage,
      rating,
      favorites,
      synopsis,
      genres,
      info,
      chapters,
      chaptersCount: chapters.length,
    });
  } catch (err) {
    console.error('Error scraping manga detail:', err.message);
    res.status(500).json({ error: err.message || 'Terjadi kesalahan internal' });
  }
}

async function getChapterImages(req, res) {
  const { slug, chapterSlug } = req.params;
  const chapterUrl = `${BASE_URL}/manga/${slug}/${chapterSlug}/`;

  try {
    const $ = await fetchHtml(chapterUrl);

    const images = [];

    const readerSection = $('section[data-image-data="1"]').first();

    if (readerSection && readerSection.length) {
      readerSection.find('img').each((_, el) => {
        let src = $(el).attr('data-src') || $(el).attr('src');
        if (!src) return;

        if (src.startsWith('//')) {
          src = 'https:' + src;
        } else if (src.startsWith('/')) {
          src = BASE_URL + src;
        }

        const lower = src.toLowerCase();

        const isPanelImage =
          lower.includes('cdn.uqni.net/images') ||
          lower.match(/\.(webp|jpg|jpeg|png)$/i);

        if (!isPanelImage) return;

        images.push(src);
      });
    } else {
      $('img').each((_, el) => {
        let src = $(el).attr('data-src') || $(el).attr('src');
        if (!src) return;

        if (src.startsWith('//')) {
          src = 'https:' + src;
        } else if (src.startsWith('/')) {
          src = BASE_URL + src;
        }

        const lower = src.toLowerCase();
        const isPanelImage =
          lower.includes('cdn.uqni.net/images') ||
          lower.match(/\.(webp|jpg|jpeg|png)$/i);

        if (!isPanelImage) return;

        images.push(src);
      });
    }

    res.json({
      source: BASE_URL,
      url: chapterUrl,
      slug,
      chapterSlug,
      imagesCount: images.length,
      images,
    });
  } catch (err) {
    console.error('Error scraping chapter images:', err.message);
    res.status(500).json({ error: err.message || 'Terjadi kesalahan internal' });
  }
}

module.exports = {
  getProjectUpdates,
  getLatestUpdates,
  getMangaDetail,
  getChapterImages,
};

