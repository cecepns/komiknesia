import express from 'express';
import mysql from 'mysql2/promise';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import westMangaService from './services/westmanga.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads-komiknesia')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads-komiknesia');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Database connection
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'komiknesia'
};

let db;

try {
  db = await mysql.createConnection(dbConfig);
  console.log('Connected to MySQL database');
} catch (error) {
  console.error('Database connection failed:', error);
  process.exit(1);
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Utility function to generate slug
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
};

// Routes

// Categories Routes
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT c.*, COUNT(m.id) as manga_count 
      FROM categories c 
      LEFT JOIN manga m ON c.id = m.category_id 
      GROUP BY c.id 
      ORDER BY c.name
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name, description } = req.body;
    const [result] = await db.execute(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name, description]
    );
    res.status(201).json({ id: result.insertId, message: 'Category created successfully' });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    await db.execute(
      'UPDATE categories SET name = ?, description = ? WHERE id = ?',
      [name, description, id]
    );
    res.json({ message: 'Category updated successfully' });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manga Routes
app.get('/api/manga', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', category = '', source = 'all' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT m.*, c.name as category_name, COUNT(DISTINCT v.id) as votes
      FROM manga m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN votes v ON m.id = v.manga_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (search) {
      query += ' AND (m.title LIKE ? OR m.alternative_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (category) {
      query += ' AND (m.category_id = ? OR m.id IN (SELECT manga_id FROM manga_genres WHERE category_id = ?))';
      params.push(category, category);
    }
    
    if (source === 'manual') {
      query += ' AND m.is_input_manual = TRUE';
    } else if (source === 'westmanga') {
      query += ' AND m.is_input_manual = FALSE';
    }
    
    query += ' GROUP BY m.id ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [manga] = await db.execute(query, params);
    
    // Get genres for each manga
    for (const m of manga) {
      const [genres] = await db.execute(`
        SELECT c.id, c.name, c.slug
        FROM manga_genres mg
        JOIN categories c ON mg.category_id = c.id
        WHERE mg.manga_id = ?
      `, [m.id]);
      m.genres = genres;
    }
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(DISTINCT m.id) as total FROM manga m WHERE 1=1';
    const countParams = [];
    
    if (search) {
      countQuery += ' AND (m.title LIKE ? OR m.alternative_name LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }
    
    if (category) {
      countQuery += ' AND (m.category_id = ? OR m.id IN (SELECT manga_id FROM manga_genres WHERE category_id = ?))';
      countParams.push(category, category);
    }
    
    if (source === 'manual') {
      countQuery += ' AND m.is_input_manual = TRUE';
    } else if (source === 'westmanga') {
      countQuery += ' AND m.is_input_manual = FALSE';
    }
    
    const [countResult] = await db.execute(countQuery, countParams);
    const totalPages = Math.ceil(countResult[0].total / limit);
    
    res.json({
      manga,
      totalPages,
      currentPage: parseInt(page),
      totalCount: countResult[0].total
    });
  } catch (error) {
    console.error('Error fetching manga:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/manga/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Get manga basic info from database
    const [rows] = await db.execute(`
      SELECT m.*, c.name as category_name, COUNT(v.id) as votes
      FROM manga m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN votes v ON m.id = v.manga_id
      WHERE m.slug = ?
      GROUP BY m.id
    `, [slug]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Manga not found' });
    }
    
    const manga = rows[0];
    
    // Get genres for this manga
    const [genres] = await db.execute(`
      SELECT c.id, c.name, c.slug
      FROM manga_genres mg
      JOIN categories c ON mg.category_id = c.id
      WHERE mg.manga_id = ?
    `, [manga.id]);
    
    manga.genres = genres;
    
    // If manga is from WestManga (is_input_manual = false), fetch detail from their API
    if (!manga.is_input_manual && manga.westmanga_id) {
      try {
        const westMangaData = await westMangaService.getMangaDetail(slug);
        if (westMangaData.status && westMangaData.data) {
          // Merge with WestManga data (WestManga data takes priority for detail info)
          manga.alternative_name = westMangaData.data.alternative_name || manga.alternative_name;
          manga.synopsis = westMangaData.data.sinopsis || manga.synopsis;
          manga.chapters = westMangaData.data.chapters || [];
          manga.rating = westMangaData.data.rating || manga.rating;
          manga.bookmark_count = westMangaData.data.bookmark_count || manga.bookmark_count;
          manga.release = westMangaData.data.release || manga.release;
        }
      } catch (westError) {
        console.warn('Failed to fetch WestManga detail, using local data:', westError.message);
      }
    } else {
      // For manual input manga, get chapters from our database
      const [chapters] = await db.execute(`
        SELECT c.*, COUNT(ci.id) as image_count
        FROM chapters c
        LEFT JOIN chapter_images ci ON c.id = ci.chapter_id
        WHERE c.manga_id = ?
        GROUP BY c.id
        ORDER BY c.chapter_number DESC
      `, [manga.id]);
      manga.chapters = chapters;
    }
    
    res.json(manga);
  } catch (error) {
    console.error('Error fetching manga by slug:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/manga', upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'cover_background', maxCount: 1 }
]), async (req, res) => {
  try {
    const { 
      title, author, synopsis, category_id, genre_ids,
      alternative_name, content_type, country_id, release, status
    } = req.body;
    const slug = generateSlug(title);
    
    // Check if slug already exists
    const [existing] = await db.execute('SELECT id FROM manga WHERE slug = ?', [slug]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Manga dengan judul serupa sudah ada' });
    }
    
    const thumbnail = req.files?.thumbnail ? `/uploads/${req.files.thumbnail[0].filename}` : null;
    const cover_background = req.files?.cover_background ? `/uploads/${req.files.cover_background[0].filename}` : null;
    
    const [result] = await db.execute(`
      INSERT INTO manga (
        title, slug, author, synopsis, category_id, thumbnail, cover_background,
        alternative_name, content_type, country_id, \`release\`, status, is_input_manual
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title, slug, author, synopsis, category_id, thumbnail, cover_background,
      alternative_name || null, content_type || 'manga', country_id || null,
      release || null, status || 'ongoing', true // is_input_manual = true for manual input
    ]);
    
    const mangaId = result.insertId;
    
    // Handle genres (many-to-many relationship)
    if (genre_ids) {
      const genreArray = Array.isArray(genre_ids) ? genre_ids : JSON.parse(genre_ids);
      for (const genreId of genreArray) {
        await db.execute(
          'INSERT INTO manga_genres (manga_id, category_id) VALUES (?, ?)',
          [mangaId, genreId]
        );
      }
    }
    
    res.status(201).json({ id: mangaId, message: 'Manga created successfully' });
  } catch (error) {
    console.error('Error creating manga:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/manga/:id', upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'cover_background', maxCount: 1 }
]), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, author, synopsis, category_id, genre_ids,
      alternative_name, content_type, country_id, release, status
    } = req.body;
    const slug = generateSlug(title);
    
    // Check if slug already exists for other manga
    const [existing] = await db.execute('SELECT id FROM manga WHERE slug = ? AND id != ?', [slug, id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Manga dengan judul serupa sudah ada' });
    }
    
    let query = `UPDATE manga SET 
      title = ?, slug = ?, author = ?, synopsis = ?, category_id = ?,
      alternative_name = ?, content_type = ?, country_id = ?, \`release\` = ?, status = ?`;
    let params = [
      title, slug, author, synopsis, category_id,
      alternative_name || null, content_type || 'manga', country_id || null,
      release || null, status || 'ongoing'
    ];
    
    if (req.files?.thumbnail) {
      query += ', thumbnail = ?';
      params.push(`/uploads/${req.files.thumbnail[0].filename}`);
    }
    
    if (req.files?.cover_background) {
      query += ', cover_background = ?';
      params.push(`/uploads/${req.files.cover_background[0].filename}`);
    }
    
    query += ' WHERE id = ?';
    params.push(id);
    
    await db.execute(query, params);
    
    // Update genres (delete old and insert new)
    if (genre_ids) {
      await db.execute('DELETE FROM manga_genres WHERE manga_id = ?', [id]);
      
      const genreArray = Array.isArray(genre_ids) ? genre_ids : JSON.parse(genre_ids);
      for (const genreId of genreArray) {
        await db.execute(
          'INSERT INTO manga_genres (manga_id, category_id) VALUES (?, ?)',
          [id, genreId]
        );
      }
    }
    
    res.json({ message: 'Manga updated successfully' });
  } catch (error) {
    console.error('Error updating manga:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/manga/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM manga WHERE id = ?', [id]);
    res.json({ message: 'Manga deleted successfully' });
  } catch (error) {
    console.error('Error deleting manga:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Votes Routes
app.post('/api/votes', async (req, res) => {
  try {
    const { manga_id, vote_type } = req.body;
    const user_ip = req.ip || req.connection.remoteAddress;
    
    // Check if user already voted for this manga
    const [existing] = await db.execute(
      'SELECT id FROM votes WHERE manga_id = ? AND user_ip = ?',
      [manga_id, user_ip]
    );
    
    if (existing.length === 0) {
      await db.execute(
        'INSERT INTO votes (manga_id, vote_type, user_ip) VALUES (?, ?, ?)',
        [manga_id, vote_type, user_ip]
      );
      res.json({ message: 'Vote recorded successfully' });
    } else {
      res.status(400).json({ error: 'You have already voted for this manga' });
    }
  } catch (error) {
    console.error('Error recording vote:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Chapters Routes
app.get('/api/manga/:mangaId/chapters', async (req, res) => {
  try {
    const { mangaId } = req.params;
    const [chapters] = await db.execute(`
      SELECT c.*, COUNT(ci.id) as image_count
      FROM chapters c
      LEFT JOIN chapter_images ci ON c.id = ci.chapter_id
      WHERE c.manga_id = ?
      GROUP BY c.id
      ORDER BY c.chapter_number
    `, [mangaId]);
    
    res.json(chapters);
  } catch (error) {
    console.error('Error fetching chapters:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/manga/:mangaId/chapters', upload.single('cover'), async (req, res) => {
  try {
    const { mangaId } = req.params;
    const { title, chapter_number } = req.body;
    const cover = req.file ? `/uploads/${req.file.filename}` : null;
    
    // Get manga slug to create chapter slug
    const [mangaRows] = await db.execute('SELECT slug FROM manga WHERE id = ?', [mangaId]);
    if (mangaRows.length === 0) {
      return res.status(404).json({ error: 'Manga not found' });
    }
    
    const mangaSlug = mangaRows[0].slug;
    const chapterSlug = `${mangaSlug}-chapter-${chapter_number}`;
    
    const [result] = await db.execute(
      'INSERT INTO chapters (manga_id, title, chapter_number, slug, cover) VALUES (?, ?, ?, ?, ?)',
      [mangaId, title, chapter_number, chapterSlug, cover]
    );
    
    res.status(201).json({ id: result.insertId, message: 'Chapter created successfully' });
  } catch (error) {
    console.error('Error creating chapter:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/chapters/:id', upload.single('cover'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, chapter_number } = req.body;
    
    // Get manga slug to update chapter slug
    const [chapterRows] = await db.execute('SELECT manga_id FROM chapters WHERE id = ?', [id]);
    if (chapterRows.length === 0) {
      return res.status(404).json({ error: 'Chapter not found' });
    }
    
    const [mangaRows] = await db.execute('SELECT slug FROM manga WHERE id = ?', [chapterRows[0].manga_id]);
    if (mangaRows.length === 0) {
      return res.status(404).json({ error: 'Manga not found' });
    }
    
    const mangaSlug = mangaRows[0].slug;
    const chapterSlug = `${mangaSlug}-chapter-${chapter_number}`;
    
    let query = 'UPDATE chapters SET title = ?, chapter_number = ?, slug = ?';
    let params = [title, chapter_number, chapterSlug];
    
    if (req.file) {
      query += ', cover = ?';
      params.push(`/uploads/${req.file.filename}`);
    }
    
    query += ' WHERE id = ?';
    params.push(id);
    
    await db.execute(query, params);
    
    res.json({ message: 'Chapter updated successfully' });
  } catch (error) {
    console.error('Error updating chapter:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/chapters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM chapters WHERE id = ?', [id]);
    res.json({ message: 'Chapter deleted successfully' });
  } catch (error) {
    console.error('Error deleting chapter:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Chapter Images Routes
app.post('/api/chapters/:chapterId/images', upload.array('images', 50), async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }
    
    const insertPromises = req.files.map((file, index) => {
      return db.execute(
        'INSERT INTO chapter_images (chapter_id, image_path, page_number) VALUES (?, ?, ?)',
        [chapterId, `/uploads/${file.filename}`, index + 1]
      );
    });
    
    await Promise.all(insertPromises);
    
    res.status(201).json({ message: 'Images uploaded successfully' });
  } catch (error) {
    console.error('Error uploading chapter images:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ads Routes
app.get('/api/ads', async (req, res) => {
  try {
    const [ads] = await db.execute('SELECT * FROM ads ORDER BY created_at DESC');
    res.json(ads);
  } catch (error) {
    console.error('Error fetching ads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/ads', upload.single('image'), async (req, res) => {
  try {
    const { link_url, ads_type } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    
    const [result] = await db.execute(
      'INSERT INTO ads (image, link_url, ads_type) VALUES (?, ?, ?)',
      [image, link_url, ads_type]
    );
    
    res.status(201).json({ id: result.insertId, message: 'Ad created successfully' });
  } catch (error) {
    console.error('Error creating ad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/ads/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { link_url, ads_type } = req.body;
    
    let query = 'UPDATE ads SET link_url = ?, ads_type = ?';
    let params = [link_url, ads_type];
    
    if (req.file) {
      query += ', image = ?';
      params.push(`/uploads/${req.file.filename}`);
    }
    
    query += ' WHERE id = ?';
    params.push(id);
    
    await db.execute(query, params);
    
    res.json({ message: 'Ad updated successfully' });
  } catch (error) {
    console.error('Error updating ad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/ads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM ads WHERE id = ?', [id]);
    res.json({ message: 'Ad deleted successfully' });
  } catch (error) {
    console.error('Error deleting ad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WestManga Integration Routes

// Get manga list from WestManga API
app.get('/api/westmanga/list', async (req, res) => {
  try {
    const { page = 1, per_page = 25, search, genre, status, type, sort } = req.query;
    const result = await westMangaService.getMangaList({
      page: parseInt(page),
      per_page: parseInt(per_page),
      search,
      genre,
      status,
      type,
      sort
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching WestManga list:', error);
    res.status(500).json({ error: 'Failed to fetch manga from WestManga' });
  }
});

// Sync manga from WestManga to our database
app.post('/api/westmanga/sync', async (req, res) => {
  try {
    const { page = 1, limit = 25 } = req.body;
    
    // Fetch manga list from WestManga
    const westMangaData = await westMangaService.getMangaList({ 
      page, 
      per_page: limit 
    });
    
    if (!westMangaData.status || !westMangaData.data) {
      return res.status(400).json({ error: 'Failed to fetch data from WestManga' });
    }
    
    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const mangaData of westMangaData.data) {
      try {
        // Check if manga already exists
        const [existing] = await db.execute(
          'SELECT id FROM manga WHERE westmanga_id = ?',
          [mangaData.id]
        );
        
        if (existing.length > 0) {
          // Update existing manga
          const transformed = westMangaService.transformMangaData(mangaData);
          await db.execute(`
            UPDATE manga SET 
              title = ?, slug = ?, alternative_name = ?, author = ?,
              synopsis = ?, thumbnail = ?, content_type = ?, country_id = ?,
              color = ?, hot = ?, is_project = ?, is_safe = ?,
              rating = ?, bookmark_count = ?, views = ?, \`release\` = ?,
              status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE westmanga_id = ?
          `, [
            transformed.title, transformed.slug, transformed.alternative_name,
            transformed.author, transformed.synopsis, transformed.thumbnail,
            transformed.content_type, transformed.country_id, transformed.color,
            transformed.hot, transformed.is_project, transformed.is_safe,
            transformed.rating, transformed.bookmark_count, transformed.views,
            transformed.release, transformed.status, transformed.westmanga_id
          ]);
          
          skippedCount++;
        } else {
          // Insert new manga
          const transformed = westMangaService.transformMangaData(mangaData);
          const [result] = await db.execute(`
            INSERT INTO manga (
              westmanga_id, title, slug, alternative_name, author,
              synopsis, thumbnail, content_type, country_id,
              color, hot, is_project, is_safe, rating,
              bookmark_count, views, \`release\`, status, is_input_manual
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            transformed.westmanga_id, transformed.title, transformed.slug,
            transformed.alternative_name, transformed.author, transformed.synopsis,
            transformed.thumbnail, transformed.content_type, transformed.country_id,
            transformed.color, transformed.hot, transformed.is_project,
            transformed.is_safe, transformed.rating, transformed.bookmark_count,
            transformed.views, transformed.release, transformed.status,
            transformed.is_input_manual
          ]);
          
          const mangaId = result.insertId;
          
          // Sync genres if available
          if (mangaData.genres && Array.isArray(mangaData.genres)) {
            for (const genre of mangaData.genres) {
              // Try to find matching category by name (case-insensitive)
              const [category] = await db.execute(
                'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)',
                [genre.name]
              );
              
              if (category.length > 0) {
                // Insert into manga_genres junction table
                await db.execute(`
                  INSERT IGNORE INTO manga_genres (manga_id, category_id)
                  VALUES (?, ?)
                `, [mangaId, category[0].id]);
              }
            }
          }
          
          syncedCount++;
        }
      } catch (itemError) {
        console.error(`Error syncing manga ${mangaData.slug}:`, itemError);
        errorCount++;
      }
    }
    
    res.json({
      message: 'Sync completed',
      synced: syncedCount,
      updated: skippedCount,
      errors: errorCount,
      total: westMangaData.data.length
    });
  } catch (error) {
    console.error('Error syncing WestManga data:', error);
    res.status(500).json({ error: 'Failed to sync manga from WestManga' });
  }
});

// Get chapter detail (handles both manual and WestManga)
app.get('/api/chapters/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // First, check if chapter exists in our database
    const [chapters] = await db.execute(`
      SELECT c.*, m.is_input_manual, m.slug as manga_slug
      FROM chapters c
      JOIN manga m ON c.manga_id = m.id
      WHERE c.slug = ?
    `, [slug]);
    
    if (chapters.length > 0) {
      const chapter = chapters[0];
      
      // If manual input, get images from database
      if (chapter.is_input_manual) {
        const [images] = await db.execute(`
          SELECT image_path, page_number
          FROM chapter_images
          WHERE chapter_id = ?
          ORDER BY page_number
        `, [chapter.id]);
        
        chapter.images = images;
        return res.json(chapter);
      }
    }
    
    // If not found or from WestManga, fetch from their API
    try {
      const westChapterData = await westMangaService.getChapterDetail(slug);
      if (westChapterData.status && westChapterData.data) {
        return res.json(westChapterData.data);
      }
    } catch (westError) {
      console.error('Failed to fetch chapter from WestManga:', westError);
    }
    
    res.status(404).json({ error: 'Chapter not found' });
  } catch (error) {
    console.error('Error fetching chapter:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search manga (combines local and WestManga results)
app.get('/api/manga/search', async (req, res) => {
  try {
    const { query, source = 'all' } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    let localResults = [];
    let westMangaResults = [];
    
    // Search local database
    if (source === 'all' || source === 'local') {
      const [rows] = await db.execute(`
        SELECT m.*, c.name as category_name
        FROM manga m
        LEFT JOIN categories c ON m.category_id = c.id
        WHERE m.title LIKE ? OR m.alternative_name LIKE ?
        LIMIT 20
      `, [`%${query}%`, `%${query}%`]);
      localResults = rows;
    }
    
    // Search WestManga API
    if (source === 'all' || source === 'westmanga') {
      try {
        const westData = await westMangaService.searchManga(query);
        if (westData.status && westData.data) {
          westMangaResults = westData.data;
        }
      } catch (westError) {
        console.warn('WestManga search failed:', westError.message);
      }
    }
    
    res.json({
      local: localResults,
      westmanga: westMangaResults,
      total: localResults.length + westMangaResults.length
    });
  } catch (error) {
    console.error('Error searching manga:', error);
    res.status(500).json({ error: 'Internal server error' });
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
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});