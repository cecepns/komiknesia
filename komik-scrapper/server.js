require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { uploadUrlToS3 } = require('./src/s3');
const { sendToBackend } = require('./src/api');

const apkomikScraper = require('./src/scrapers/apkomik');
const kiryuuScraper = require('./src/scrapers/kiryuu');

const scrapers = {
  apkomik: apkomikScraper,
  kiryuu: kiryuuScraper,
};

const app = express();
app.use(cors());
app.use(express.json());

// PREVIEW ENDPOINT
app.get('/api/preview', async (req, res) => {
  const { source, urlOrSlug } = req.query;
  if (!source || !scrapers[source]) {
    return res.status(400).json({ error: 'Invalid source' });
  }

  const scraper = scrapers[source];
  const target = scraper.resolveMangaTarget(urlOrSlug);
  
  if (!target.slug) {
    return res.status(400).json({ error: 'Gagal mendeteksi slug dari input' });
  }

  try {
    const mangaDetail = await scraper.scrapeMangaDetail(target.slug, target.baseUrl);
    res.json({ target, mangaDetail });
  } catch (error) {
    res.status(500).json({ error: `Gagal mengambil detail: ${error.message}` });
  }
});

// LIST MANGA ENDPOINT
app.get('/api/list-manga', async (req, res) => {
  const { source, url } = req.query;
  if (!source || !scrapers[source]) {
    return res.status(400).json({ error: 'Invalid source' });
  }

  const scraper = scrapers[source];
  try {
    const list = await scraper.scrapeMangaList(url);
    res.json({ success: true, list });
  } catch (error) {
    res.status(500).json({ error: `Gagal mengambil daftar manga: ${error.message}` });
  }
});

// SSE PROCESS ENDPOINT
app.get('/api/process', async (req, res) => {
  const { source, slug, baseUrl, chapters, syncPerChapter } = req.query;
  const isSyncPerChapter = syncPerChapter === 'true';
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
 
  const sendEvent = (type, data) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
 
  const scraper = scrapers[source];
  if (!scraper) {
    sendEvent('error', { message: 'Invalid source' });
    return res.end();
  }
 
  let selectedChapters = [];
  try {
    selectedChapters = JSON.parse(chapters);
  } catch (e) {
    sendEvent('error', { message: 'Invalid chapters format' });
    return res.end();
  }
 
  try {
    sendEvent('log', { message: `Mengambil detail ulang untuk ${slug}...` });
    const mangaDetail = await scraper.scrapeMangaDetail(slug, baseUrl);
 
    // Upload Cover
    if (mangaDetail.coverImage) {
      sendEvent('log', { message: 'Mengupload cover image ke R2...' });
      const extFromUrl = (() => {
        try {
          return path.extname(String(mangaDetail.coverImage).split('?')[0]) || '.webp';
        } catch { return '.webp'; }
      })();
      const key = `komiknesia/${scraper.SOURCE}/manga/${mangaDetail.slug}/cover${extFromUrl}`;
      try {
        const r2Url = await uploadUrlToS3(key, mangaDetail.coverImage);
        mangaDetail.coverImage = r2Url;
        sendEvent('log', { message: `Cover berhasil diupload.` });
      } catch (e) {
        sendEvent('log', { message: `Gagal upload cover: ${e.message}. Menggunakan URL asli.` });
      }
    }
 
    // Process Chapters
    const processedChapters = [];
    for (let i = 0; i < selectedChapters.length; i++) {
      const ch = selectedChapters[i];
      sendEvent('log', { message: `\n[Chapter ${i+1}/${selectedChapters.length}] Scraping ${ch.title}...` });
      
      try {
        const images = await scraper.scrapeChapterImages(ch.url, baseUrl);
        sendEvent('log', { message: `Ditemukan ${images.length} gambar. Memulai upload...` });
 
        const r2Images = [];
        for (let j = 0; j < images.length; j++) {
          const imgUrl = images[j];
          const ext = path.extname(imgUrl.split('?')[0]) || '.webp';
          const key = `komiknesia/${scraper.SOURCE}/chapters/${mangaDetail.slug}/${ch.slug}/pages/${j + 1}${ext}`;
          
          sendEvent('progress', { chapter: ch.title, total: images.length, current: j + 1 });
          
          try {
            const r2Url = await uploadUrlToS3(key, imgUrl);
            r2Images.push(r2Url);
            sendEvent('log', { message: `Halaman ${j+1}/${images.length} OK` });
          } catch (e) {
            sendEvent('log', { message: `Halaman ${j+1}/${images.length} GAGAL (${e.message})` });
            r2Images.push(imgUrl);
          }
        }
 
        const processedChapter = {
          slug: ch.slug,
          title: ch.title,
          chapterNumber: ch.chapterNumber,
          images: r2Images,
        };
        
        processedChapters.push(processedChapter);

        if (isSyncPerChapter) {
          sendEvent('log', { message: `📡 Mengirim Chapter ${ch.title} ke backend Komiknesia...` });
          const payload = {
            source: scraper.SOURCE,
            mangaDetail: {
              title: mangaDetail.title,
              slug: mangaDetail.slug,
              alternativeName: mangaDetail.alternativeName,
              synopsis: mangaDetail.synopsis,
              contentType: mangaDetail.contentType,
              rating: mangaDetail.rating,
              coverImage: mangaDetail.coverImage,
              genres: mangaDetail.genres,
            },
            chapters: [processedChapter],
          };
          try {
            const resApi = await sendToBackend(payload);
            sendEvent('log', { message: `✅ Sukses mengirim Chapter ${ch.title} ke backend.` });
          } catch (e) {
            sendEvent('log', { message: `❌ GAGAL mengirim Chapter ${ch.title} ke backend: ${e.message}` });
          }

          if (i < selectedChapters.length - 1) {
            sendEvent('log', { message: `Menunggu 2 detik sebelum chapter berikutnya...` });
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
 
      } catch (e) {
        sendEvent('log', { message: `❌ Gagal memproses chapter ${ch.title}: ${e.message}` });
      }
    }
 
    if (!isSyncPerChapter) {
      sendEvent('log', { message: '\n📡 Mengirim data ke backend Komiknesia...' });
      const payload = {
        source: scraper.SOURCE,
        mangaDetail: {
          title: mangaDetail.title,
          slug: mangaDetail.slug,
          alternativeName: mangaDetail.alternativeName,
          synopsis: mangaDetail.synopsis,
          contentType: mangaDetail.contentType,
          rating: mangaDetail.rating,
          coverImage: mangaDetail.coverImage,
          genres: mangaDetail.genres,
        },
        chapters: processedChapters,
      };
 
      try {
        const resApi = await sendToBackend(payload);
        sendEvent('log', { message: `✅ SUKSES! Data tersimpan.` });
        sendEvent('done', { success: true, result: resApi });
      } catch (e) {
        sendEvent('log', { message: `❌ GAGAL mengirim ke backend: ${e.message}` });
        sendEvent('done', { success: false, error: e.message });
      }
    } else {
      sendEvent('log', { message: `\n✅ SUKSES! Semua ${selectedChapters.length} chapter berhasil diproses dan disinkronkan.` });
      sendEvent('done', { success: true });
    }
 
  } catch (error) {
    sendEvent('error', { message: `Terjadi kesalahan sistem: ${error.message}` });
  }
 
  res.end();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Local Scrapper API running on http://localhost:${PORT}`);
});
