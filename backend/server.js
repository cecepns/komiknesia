import express from 'express';
import mysql from 'mysql2/promise';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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
    const { page = 1, limit = 12, search = '', category = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT m.*, c.name as category_name, COUNT(v.id) as votes
      FROM manga m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN votes v ON m.id = v.manga_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (search) {
      query += ' AND m.title LIKE ?';
      params.push(`%${search}%`);
    }
    
    if (category) {
      query += ' AND m.category_id = ?';
      params.push(category);
    }
    
    query += ' GROUP BY m.id ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [manga] = await db.execute(query, params);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM manga m WHERE 1=1';
    const countParams = [];
    
    if (search) {
      countQuery += ' AND m.title LIKE ?';
      countParams.push(`%${search}%`);
    }
    
    if (category) {
      countQuery += ' AND m.category_id = ?';
      countParams.push(category);
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
    
    res.json(rows[0]);
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
    const { title, author, synopsis, category_id } = req.body;
    const slug = generateSlug(title);
    
    // Check if slug already exists
    const [existing] = await db.execute('SELECT id FROM manga WHERE slug = ?', [slug]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Manga dengan judul serupa sudah ada' });
    }
    
    const thumbnail = req.files?.thumbnail ? `/uploads/${req.files.thumbnail[0].filename}` : null;
    const cover_background = req.files?.cover_background ? `/uploads/${req.files.cover_background[0].filename}` : null;
    
    const [result] = await db.execute(
      'INSERT INTO manga (title, slug, author, synopsis, category_id, thumbnail, cover_background) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, slug, author, synopsis, category_id, thumbnail, cover_background]
    );
    
    res.status(201).json({ id: result.insertId, message: 'Manga created successfully' });
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
    const { title, author, synopsis, category_id } = req.body;
    const slug = generateSlug(title);
    
    // Check if slug already exists for other manga
    const [existing] = await db.execute('SELECT id FROM manga WHERE slug = ? AND id != ?', [slug, id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Manga dengan judul serupa sudah ada' });
    }
    
    let query = 'UPDATE manga SET title = ?, slug = ?, author = ?, synopsis = ?, category_id = ?';
    let params = [title, slug, author, synopsis, category_id];
    
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
    
    const [result] = await db.execute(
      'INSERT INTO chapters (manga_id, title, chapter_number, cover) VALUES (?, ?, ?, ?)',
      [mangaId, title, chapter_number, cover]
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
    
    let query = 'UPDATE chapters SET title = ?, chapter_number = ?';
    let params = [title, chapter_number];
    
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