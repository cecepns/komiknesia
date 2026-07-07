/* eslint-disable no-undef */
/* eslint-env node */
const db = require('../db');
const { uploadUrlToS3 } = require('../utils/s3Upload');
const path = require('path');

const activeMigrations = new Map();

// Helper to check if a URL is already in R2/S3
function isAlreadyMigrated(url) {
  if (!url) return true;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return true; // local uploads
  const s3Endpoint = process.env.S3_ENDPOINT || 'https://33cbe0d28cbe34b858c352c662d477d6.r2.cloudflarestorage.com';
  const s3PublicUrl = process.env.S3_PUBLIC_URL || '';
  try {
    const parsedEndpoint = new URL(s3Endpoint);
    const host = parsedEndpoint.hostname.toLowerCase();
    const lowerUrl = url.toLowerCase();
    
    let isPublicMatch = false;
    if (s3PublicUrl) {
      try {
        const parsedPublic = new URL(s3PublicUrl);
        isPublicMatch = lowerUrl.includes(parsedPublic.hostname.toLowerCase());
      } catch {}
    }
    
    return lowerUrl.includes(host) || isPublicMatch || lowerUrl.includes('cloudflarestorage.com') || lowerUrl.includes('cloudhost.id');
  } catch {
    return false;
  }
}

function getExtensionFromUrl(url) {
  if (!url) return '.jpg';
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const ext = path.extname(pathname);
    if (ext && ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext.toLowerCase())) {
      return ext.toLowerCase();
    }
  } catch {}
  return '.jpg';
}

const listManga = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const search = req.query.search || '';
    const status = req.query.status || 'all'; // all, pending, migrated
    
    const offset = (page - 1) * limit;
    
    const s3Endpoint = process.env.S3_ENDPOINT || 'https://33cbe0d28cbe34b858c352c662d477d6.r2.cloudflarestorage.com';
    const s3PublicUrl = process.env.S3_PUBLIC_URL || '';
    let r2Host = '%cloudflarestorage.com%';
    let publicHost = '%komiknesia%'; // dummy fallback
    try {
      const parsedEndpoint = new URL(s3Endpoint);
      r2Host = `%${parsedEndpoint.hostname}%`;
    } catch {}
    if (s3PublicUrl) {
      try {
        const parsedPublic = new URL(s3PublicUrl);
        publicHost = `%${parsedPublic.hostname}%`;
      } catch {}
    }

    let countQuery = `
      SELECT COUNT(DISTINCT m.id) as total
      FROM manga m
      WHERE 1=1
    `;

    let dataQuery = `
      SELECT m.id, m.title, m.slug, m.thumbnail,
        (m.thumbnail LIKE 'http%' AND m.thumbnail NOT LIKE ? AND m.thumbnail NOT LIKE ?) as cover_pending,
        (
          SELECT COUNT(*)
          FROM chapters c2
          JOIN chapter_images ci2 ON c2.id = ci2.chapter_id
          WHERE c2.manga_id = m.id AND ci2.image_path LIKE 'http%' AND ci2.image_path NOT LIKE ? AND ci2.image_path NOT LIKE ?
        ) as pending_pages_count
      FROM manga m
      WHERE 1=1
    `;

    const dataParams = [r2Host, publicHost, r2Host, publicHost];
    const countParams = [];

    if (search) {
      const searchPattern = `%${search}%`;
      dataQuery += ' AND (m.title LIKE ? OR m.alternative_name LIKE ?)';
      countQuery += ' AND (m.title LIKE ? OR m.alternative_name LIKE ?)';
      dataParams.push(searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern);
    }

    if (status === 'pending') {
      const pendingCondition = ` AND (
        (m.thumbnail LIKE 'http%' AND m.thumbnail NOT LIKE ? AND m.thumbnail NOT LIKE ?)
        OR EXISTS (
          SELECT 1 FROM chapters c3
          JOIN chapter_images ci3 ON c3.id = ci3.chapter_id
          WHERE c3.manga_id = m.id AND ci3.image_path LIKE 'http%' AND ci3.image_path NOT LIKE ? AND ci3.image_path NOT LIKE ?
        )
      )`;
      dataQuery += pendingCondition;
      countQuery += pendingCondition;
      dataParams.push(r2Host, publicHost, r2Host, publicHost);
      countParams.push(r2Host, publicHost, r2Host, publicHost);
    } else if (status === 'migrated') {
      const migratedCondition = ` AND NOT (
        (m.thumbnail LIKE 'http%' AND m.thumbnail NOT LIKE ? AND m.thumbnail NOT LIKE ?)
      ) AND NOT EXISTS (
        SELECT 1 FROM chapters c3
        JOIN chapter_images ci3 ON c3.id = ci3.chapter_id
        WHERE c3.manga_id = m.id AND ci3.image_path LIKE 'http%' AND ci3.image_path NOT LIKE ? AND ci3.image_path NOT LIKE ?
      )`;
      dataQuery += migratedCondition;
      countQuery += migratedCondition;
      dataParams.push(r2Host, publicHost, r2Host, publicHost);
      countParams.push(r2Host, publicHost, r2Host, publicHost);
    }

    dataQuery += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    dataParams.push(limit, offset);

    const [mangaRows] = await db.execute(dataQuery, dataParams);
    const [countRows] = await db.execute(countQuery, countParams);

    const total = countRows[0]?.total || 0;

    res.json({
      success: true,
      data: mangaRows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    console.error('Error listing manga for migration:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

async function runMigrationWorker(mangaIds, taskId) {
  const task = activeMigrations.get(taskId);
  if (!task) return;

  const log = (msg) => {
    const time = new Date().toLocaleTimeString();
    const formatted = `[${time}] ${msg}`;
    task.logs.push(formatted);
    if (task.logs.length > 1000) {
      task.logs.shift();
    }
  };

  const logError = (msg, err) => {
    const errMsg = err?.message || String(err);
    const formatted = `${msg}: ${errMsg}`;
    log(`❌ ${formatted}`);
    task.errors.push(formatted);
  };

  log(`Memulai tugas migrasi untuk ${mangaIds.length} komik.`);

  try {
    for (let i = 0; i < mangaIds.length; i++) {
      const mangaId = mangaIds[i];
      if (task.status === 'aborted') {
        log('Migrasi dihentikan oleh user.');
        break;
      }

      const [mangaRows] = await db.execute('SELECT id, title, slug, thumbnail FROM manga WHERE id = ?', [mangaId]);
      if (mangaRows.length === 0) {
        log(`Komik dengan ID ${mangaId} tidak ditemukan, melewati.`);
        task.processedManga++;
        continue;
      }

      const manga = mangaRows[0];
      log(`----------------------------------------`);
      log(`Memproses komik [${manga.id}]: "${manga.title}"`);

      // 1. Migrasi Cover/Thumbnail
      if (manga.thumbnail && !isAlreadyMigrated(manga.thumbnail)) {
        log(`Cover perlu migrasi: ${manga.thumbnail}`);
        try {
          const ext = getExtensionFromUrl(manga.thumbnail);
          const s3Key = `komiknesia/manga/${manga.id}/cover-${Date.now()}${ext}`;
          log(`Mengupload cover ke R2/S3 dengan key: ${s3Key}`);
          const newUrl = await uploadUrlToS3(s3Key, manga.thumbnail);

          await db.execute('UPDATE manga SET thumbnail = ? WHERE id = ?', [newUrl, manga.id]);
          log(`Cover berhasil dimigrasikan ke R2/S3: ${newUrl}`);
        } catch (err) {
          logError(`Gagal migrasi cover komik "${manga.title}"`, err);
        }
      } else {
        log(`Cover sudah berada di R2/S3 atau lokal.`);
      }

      // 2. Migrasi Chapter Pages
      const [chapters] = await db.execute('SELECT id, chapter_number, title FROM chapters WHERE manga_id = ?', [manga.id]);
      log(`Menemukan ${chapters.length} chapter.`);

      for (const chapter of chapters) {
        if (task.status === 'aborted') break;
        log(`Memproses chapter ${chapter.chapter_number}: "${chapter.title || ''}" (ID: ${chapter.id})`);

        const [images] = await db.execute('SELECT id, image_path, page_number FROM chapter_images WHERE chapter_id = ? ORDER BY page_number', [chapter.id]);

        for (const img of images) {
          if (img.image_path && !isAlreadyMigrated(img.image_path)) {
            try {
              const ext = getExtensionFromUrl(img.image_path);
              const s3Key = `komiknesia/chapters/${chapter.id}/pages/${img.page_number}-${Date.now()}${ext}`;
              log(`  Migrasi page ${img.page_number}: ${img.image_path.slice(0, 80)}...`);
              const newUrl = await uploadUrlToS3(s3Key, img.image_path);

              await db.execute('UPDATE chapter_images SET image_path = ? WHERE id = ?', [newUrl, img.id]);
              task.processedImages++;
            } catch (err) {
              const statusCode = err.response?.status || '';
              logError(`Gagal migrasi gambar chapter page ${img.page_number} (ID: ${chapter.id}) [${statusCode}] url=${img.image_path.slice(0, 100)}`, err);
            }
          }
        }
        task.processedChapters++;
      }
      task.processedManga++;
      log(`Selesai memproses komik: "${manga.title}"`);
    }

    if (task.status !== 'aborted') {
      task.status = 'completed';
      log(`Tugas migrasi ${taskId} selesai.`);
    }
    task.completedAt = new Date().toISOString();
  } catch (globalError) {
    task.status = 'failed';
    task.completedAt = new Date().toISOString();
    logError(`Tugas migrasi terhenti karena kesalahan kritis`, globalError);
  }
}

const startMigration = async (req, res) => {
  try {
    const { mangaIds } = req.body;
    if (!Array.isArray(mangaIds) || mangaIds.length === 0) {
      return res.status(400).json({ success: false, error: 'mangaIds harus berupa array dan tidak kosong' });
    }

    const taskId = `task_${Date.now()}`;
    const taskInfo = {
      id: taskId,
      status: 'processing',
      totalManga: mangaIds.length,
      processedManga: 0,
      totalChapters: 0,
      processedChapters: 0,
      totalImages: 0,
      processedImages: 0,
      logs: [],
      errors: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
    };

    activeMigrations.set(taskId, taskInfo);

    // Bersihkan task lama jika memori map terlalu besar (max 50 tasks)
    if (activeMigrations.size > 50) {
      const firstKey = activeMigrations.keys().next().value;
      activeMigrations.delete(firstKey);
    }

    runMigrationWorker(mangaIds, taskId).catch((err) => {
      console.error(`[Migration task ${taskId}] Worker crash:`, err);
    });

    res.json({
      success: true,
      message: 'Tugas migrasi berhasil dimulai',
      taskId,
    });
  } catch (error) {
    console.error('Error starting migration:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

const getStatus = async (req, res) => {
  const { taskId } = req.params;
  const task = activeMigrations.get(taskId);
  if (!task) {
    return res.status(404).json({ success: false, error: 'Tugas migrasi tidak ditemukan' });
  }
  res.json({ success: true, task });
};

const abortMigration = async (req, res) => {
  const { taskId } = req.params;
  const task = activeMigrations.get(taskId);
  if (!task) {
    return res.status(404).json({ success: false, error: 'Tugas migrasi tidak ditemukan' });
  }
  if (task.status === 'processing') {
    task.status = 'aborted';
    task.completedAt = new Date().toISOString();
  }
  res.json({ success: true, message: 'Tugas dihentikan' });
};

module.exports = {
  listManga,
  startMigration,
  getStatus,
  abortMigration,
};
