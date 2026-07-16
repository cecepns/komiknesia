require('dotenv').config();
const inquirer = require('inquirer');
const path = require('path');
const { uploadUrlToS3 } = require('./src/s3');
const { sendToBackend } = require('./src/api');

const apkomikScraper = require('./src/scrapers/apkomik');
const kiryuuScraper = require('./src/scrapers/kiryuu');

const scrapers = {
  apkomik: apkomikScraper,
  kiryuu: kiryuuScraper,
};

async function main() {
  console.log('\n======================================');
  console.log('   KOMIKNESIA LOCAL SCRAPPER CLI');
  console.log('======================================\n');

  const { sourceKey } = await inquirer.prompt([
    {
      type: 'list',
      name: 'sourceKey',
      message: 'Pilih sumber komik:',
      choices: [
        { name: 'Apkomik (01.apkomik.com)', value: 'apkomik' },
        { name: 'Kiryuu (v6.kiryuu.to)', value: 'kiryuu' },
      ],
    },
  ]);

  const scraper = scrapers[sourceKey];

  const { urlOrSlug } = await inquirer.prompt([
    {
      type: 'input',
      name: 'urlOrSlug',
      message: 'Masukkan URL Manga atau Slug:',
      validate: (input) => input.trim() !== '' || 'URL/Slug tidak boleh kosong',
    },
  ]);

  const target = scraper.resolveMangaTarget(urlOrSlug);
  if (!target.slug) {
    console.error('❌ Gagal mendeteksi slug dari input tersebut.');
    process.exit(1);
  }

  console.log(`\n⏳ Sedang mengambil data detail manga untuk slug: ${target.slug}...`);
  let mangaDetail;
  try {
    mangaDetail = await scraper.scrapeMangaDetail(target.slug, target.baseUrl);
    console.log(`✅ Manga ditemukan: ${mangaDetail.title} (${mangaDetail.chapters.length} chapter tersedia)`);
  } catch (error) {
    console.error(`❌ Gagal mengambil detail manga: ${error.message}`);
    process.exit(1);
  }

  const { scrapeChaptersChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'scrapeChaptersChoice',
      message: 'Chapter mana yang ingin di scrape?',
      choices: [
        { name: 'Hanya chapter terbaru (1 chapter)', value: 'latest' },
        { name: 'Semua chapter', value: 'all' },
        { name: 'Pilih chapter tertentu', value: 'select' },
      ],
    },
  ]);

  let selectedChapters = [];
  if (scrapeChaptersChoice === 'latest') {
    selectedChapters = mangaDetail.chapters.length > 0 ? [mangaDetail.chapters[0]] : [];
  } else if (scrapeChaptersChoice === 'all') {
    selectedChapters = mangaDetail.chapters;
  } else {
    const { chosen } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'chosen',
        message: 'Pilih chapter (gunakan spasi untuk memilih):',
        choices: mangaDetail.chapters.map((ch, idx) => ({ name: ch.title, value: idx })),
      },
    ]);
    selectedChapters = chosen.map((idx) => mangaDetail.chapters[idx]);
  }

  if (selectedChapters.length === 0) {
    console.log('⚠️ Tidak ada chapter yang dipilih. Keluar...');
    process.exit(0);
  }

  console.log(`\n🚀 Memulai proses scraping dan upload ke R2...`);

  // Upload Cover Image
  if (mangaDetail.coverImage) {
    console.log(`\n🖼️ Mengupload cover image...`);
    const extFromUrl = (() => {
      try {
        const clean = String(mangaDetail.coverImage).split('?')[0];
        return path.extname(clean) || '.webp';
      } catch {
        return '.webp';
      }
    })();
    const key = `komiknesia/${scraper.SOURCE}/manga/${mangaDetail.slug}/cover${extFromUrl}`;
    try {
      const r2Url = await uploadUrlToS3(key, mangaDetail.coverImage);
      mangaDetail.coverImage = r2Url;
      console.log(`✅ Cover berhasil diupload: ${r2Url}`);
    } catch (e) {
      console.error(`⚠️ Gagal upload cover: ${e.message}`);
      // Lanjut saja dengan URL asli jika gagal
    }
  }

  // Scrape & Upload Chapters
  const processedChapters = [];

  for (let i = 0; i < selectedChapters.length; i++) {
    const ch = selectedChapters[i];
    console.log(`\n📖 Scraping chapter: ${ch.title} (${i + 1}/${selectedChapters.length})...`);
    try {
      const images = await scraper.scrapeChapterImages(ch.url, target.baseUrl);
      console.log(`   Ditemukan ${images.length} gambar. Mulai upload ke R2...`);

      const r2Images = [];
      for (let j = 0; j < images.length; j++) {
        const imgUrl = images[j];
        const ext = path.extname(imgUrl.split('?')[0]) || '.webp';
        // Format path: komiknesia/apkomik/chapters/manga-slug/chapter-slug/pages/1.jpg
        const key = `komiknesia/${scraper.SOURCE}/chapters/${mangaDetail.slug}/${ch.slug}/pages/${j + 1}${ext}`;
        
        process.stdout.write(`   ⬆️ Mengupload halaman ${j + 1}/${images.length}...`);
        try {
          const r2Url = await uploadUrlToS3(key, imgUrl);
          r2Images.push(r2Url);
          process.stdout.write(` OK\n`);
        } catch (e) {
          process.stdout.write(` GAGAL (${e.message})\n`);
          r2Images.push(imgUrl); // Fallback ke URL asli
        }
      }

      processedChapters.push({
        slug: ch.slug,
        title: ch.title,
        chapterNumber: ch.chapterNumber,
        images: r2Images,
      });

    } catch (e) {
      console.error(`❌ Gagal memproses chapter ${ch.title}: ${e.message}`);
    }
  }

  console.log(`\n📡 Mengirim data ke backend Komiknesia...`);
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
    const res = await sendToBackend(payload);
    console.log(`\n✅ SUKSES! Data berhasil disimpan di database.`);
    console.log(res);
  } catch (error) {
    console.error(`\n❌ GAGAL mengirim ke backend: ${error.message}`);
    // Optional: save payload to file if failed so it can be retried manually
    const fs = require('fs');
    const backupFile = `backup-${mangaDetail.slug}-${Date.now()}.json`;
    fs.writeFileSync(backupFile, JSON.stringify(payload, null, 2));
    console.log(`⚠️ Payload disimpan ke ${backupFile} untuk keperluan manual retry.`);
  }

  console.log('\nSelesai!');
}

main().catch(console.error);
