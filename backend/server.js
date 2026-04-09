/* eslint-env node */
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/authRoutes');
const categoriesRoutes = require('./routes/categoriesRoutes');
const contentsRoutes = require('./routes/contentsRoutes');
const bookmarkRoutes = require('./routes/bookmarkRoutes');
const commentRoutes = require('./routes/commentRoutes');
const voteRoutes = require('./routes/voteRoutes');
const chapterRoutes = require('./routes/chapterRoutes');
const mangaRoutes = require('./routes/mangaRoutes');
const comicRoutes = require('./routes/comicRoutes');
const adsRoutes = require('./routes/adsRoutes');
const featuredItemsRoutes = require('./routes/featuredItemsRoutes');
const sitemapRoutes = require('./routes/sitemapRoutes');
const ikiruRoutes = require('./routes/ikiruRoutes');
const ikiruSyncRoutes = require('./routes/ikiruSyncRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const contactInfoRoutes = require('./routes/contactInfoRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const premiumOrderRoutes = require('./routes/premiumOrderRoutes');
const stickerRoutes = require('./routes/stickerRoutes');

const app = express();
const PORT = 8080;

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://komiknesia.vercel.app',
  'https://komiknesia.net',
  'https://www.komiknesia.asia',
  'https://02.komiknesia.asia',
  'https://www.02.komiknesia.asia' // pastikan versi www juga ada
];

app.use(cors({
  origin: function (origin, callback) {
    // Jika request tidak ada origin (misal Postman), izinkan juga
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads-komiknesia')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads-komiknesia');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const db = require('./db');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/contents', contentsRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/manga', mangaRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/comic', comicRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/featured-items', featuredItemsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/contact-info', contactInfoRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/premium-orders', premiumOrderRoutes);
app.use('/api/stickers', stickerRoutes);
app.use('/api/ikiru', ikiruRoutes);
app.use('/api/admin/ikiru-sync', ikiruSyncRoutes);
app.use('/', sitemapRoutes);



// (in-memory cache helpers were removed; caching is handled in dedicated modules/controllers)


// Get chapter images by slug (format lokal dan kompatibel dengan frontend)
app.get('/api/v/:chapterSlug', async (req, res) => {
  try {
    const { chapterSlug } = req.params;
    
    // First, check if chapter exists in our database
    const [chapters] = await db.execute(`
      SELECT 
        c.id,
        c.chapter_number as number,
        c.title,
        c.slug,
        c.manga_id,
        m.is_input_manual,
        m.slug as manga_slug,
        m.title as manga_title,
        m.thumbnail as manga_cover,
        m.synopsis as manga_sinopsis,
        m.author as manga_author,
        m.content_type,
        m.country_id,
        m.color,
        m.hot,
        m.is_project,
        m.is_safe,
        m.rating,
        m.bookmark_count,
        m.views as total_views,
        m.release,
        m.status
      FROM chapters c
      JOIN manga m ON c.manga_id = m.id
      WHERE c.slug = ?
    `, [chapterSlug]);
    
    if (chapters.length > 0) {
      const chapter = chapters[0];
      
      // Hanya dukung manga input manual
      if (chapter.is_input_manual) {
        // Get all images for this chapter
        const [images] = await db.execute(`
          SELECT image_path
          FROM chapter_images
          WHERE chapter_id = ?
          ORDER BY page_number
        `, [chapter.id]);
        
        // Get all chapters for this manga (for navigation)
        const [allChapters] = await db.execute(`
          SELECT 
            c.id,
            c.westmanga_chapter_id as content_id,
            c.chapter_number as number,
            c.title,
            c.slug,
            c.created_at,
            UNIX_TIMESTAMP(c.created_at) as created_at_timestamp
          FROM chapters c
          WHERE c.manga_id = ?
          ORDER BY CAST(c.chapter_number AS UNSIGNED) DESC, c.chapter_number DESC
        `, [chapter.manga_id]);
        
        // Get genres for this manga
        const [genres] = await db.execute(`
          SELECT c.id, c.name, c.slug
          FROM manga_genres mg
          JOIN categories c ON mg.category_id = c.id
          WHERE mg.manga_id = ?
        `, [chapter.manga_id]);
        
        // Format response to match WestManga API format
        const responseData = {
          images: images.map(img => {
            // Convert relative paths to full URLs if needed
            if (img.image_path && !img.image_path.startsWith('http')) {
              return img.image_path.startsWith('/uploads/') 
                ? `${req.protocol}://${req.get('host')}${img.image_path}`
                : img.image_path;
            }
            return img.image_path;
          }),
          content: {
            id: chapter.manga_id,
            title: chapter.manga_title,
            slug: chapter.manga_slug,
            alternative_name: null,
            author: chapter.manga_author || 'Unknown',
            sinopsis: chapter.manga_sinopsis || null,
            cover: chapter.manga_cover || null,
            content_type: chapter.content_type || 'comic',
            country_id: chapter.country_id || null,
            color: chapter.color ? true : false,
            hot: chapter.hot ? true : false,
            is_project: chapter.is_project ? true : false,
            is_safe: chapter.is_safe ? true : false,
            rating: parseFloat(chapter.rating) || 0,
            bookmark_count: chapter.bookmark_count || 0,
            total_views: chapter.total_views || 0,
            release: chapter.release || null,
            status: chapter.status || 'ongoing',
            genres: genres
          },
          chapters: allChapters.map(ch => ({
            id: ch.id,
            content_id: ch.content_id || ch.id,
            number: ch.number,
            title: ch.title || `Chapter ${ch.number}`,
            slug: ch.slug,
            created_at: {
              time: parseInt(ch.created_at_timestamp),
              formatted: new Date(ch.created_at).toLocaleString('id-ID')
            }
          })),
          number: chapter.number
        };
        
        return res.json({
          status: true,
          data: responseData
        });
      }
      // Jika bukan manual, tidak didukung
    }
    
    return res.status(404).json({ 
      status: false, 
      error: 'Chapter tidak ditemukan' 
    });
  } catch (error) {
    console.error('Error fetching chapter images:', error);
    res.status(500).json({ 
      status: false, 
      error: 'Internal server error' 
    });
  }
});


// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 500KB' });
    }
  }
  res.status(500).json({ error: error.message });
  next();
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const runSqlMigration = async () => {
  const statements = [
    'ALTER TABLE users ADD COLUMN name VARCHAR(100) NULL AFTER id',
    'ALTER TABLE users ADD COLUMN points INT NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN is_membership TINYINT(1) NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN membership_expires_at DATETIME NULL',
    'ALTER TABLE users ADD COLUMN bio TEXT NULL AFTER email',
    `CREATE TABLE IF NOT EXISTS user_chapter_reads (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      chapter_id INT NOT NULL,
      exp_awarded INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_user_chapter_read (user_id, chapter_id),
      KEY idx_user_chapter_reads_user (user_id),
      KEY idx_user_chapter_reads_chapter (chapter_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS premium_orders (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(100) NOT NULL,
      package_id VARCHAR(50) NOT NULL,
      package_name VARCHAR(120) NOT NULL,
      package_price VARCHAR(40) NULL,
      proof_image VARCHAR(255) NOT NULL,
      payment_status ENUM('pending', 'sukses') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_premium_orders_status (payment_status),
      KEY idx_premium_orders_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS stickers (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      image_path VARCHAR(255) NOT NULL,
      is_gif TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_stickers_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];

  for (const statement of statements) {
    try {
      await db.execute(statement);
    } catch (error) {
      // Ignore duplicate column when migration already applied.
      if (error && (error.code === 'ER_DUP_FIELDNAME' || error.errno === 1060)) {
        continue;
      }
      throw error;
    }
  }

  console.log('[migration] 20260409 migration checked/applied');
};

runSqlMigration().catch((error) => {
  console.error('[migration] Failed running SQL migration:', error);
});