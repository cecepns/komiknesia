const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const westMangaService = require('./services/westmanga.js');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'komiknesia-secret-key-change-in-production';

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

// Initialize database connection and start server
(async function initDatabase() {
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('Connected to MySQL database');
    
    // Start server after database connection
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
})();

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

// Utility function to delete file from filesystem
const deleteFile = (filePath) => {
  if (!filePath) return;
  
  // Only delete files that are in our uploads directory (safety check)
  if (!filePath.startsWith('/uploads/')) {
    // Might be external URL (from WestManga), skip deletion
    return;
  }
  
  try {
    // Remove /uploads/ prefix and get filename
    const filename = filePath.replace('/uploads/', '');
    const fullPath = path.join(uploadsDir, filename);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`Deleted file: ${fullPath}`);
    }
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
    // Don't throw error, just log it
  }
};

// Auth Middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ status: false, error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user still exists
    const [users] = await db.execute('SELECT id, username, email FROM users WHERE id = ?', [decoded.userId]);
    if (users.length === 0) {
      return res.status(401).json({ status: false, error: 'User not found' });
    }

    req.user = users[0];
    next();
  } catch (error) {
    return res.status(403).json({ status: false, error: 'Invalid or expired token' });
  }
};

// Routes

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ status: false, error: 'Username and password are required' });
    }

    // Find user by username or email
    const [users] = await db.execute(
      'SELECT id, username, email, password FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({ status: false, error: 'Invalid username or password' });
    }

    const user = users[0];

    // Verify password
    // Check if password is hashed (starts with $2a$ or $2b$ for bcrypt) or plain
    const isPasswordValid = user.password.startsWith('$2')
      ? await bcrypt.compare(password, user.password)
      : password === user.password; // Fallback for plain passwords (not recommended)

    if (!isPasswordValid) {
      return res.status(401).json({ status: false, error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      status: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      status: true,
      data: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email
      }
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
});

// Contents API (similar to WestManga API format but from local database)
// Get genres list
app.get('/api/contents/genres', async (req, res) => {
  try {
    const [genres] = await db.execute(`
      SELECT id, name, slug
      FROM categories
      ORDER BY name
    `);
    res.json({
      status: true,
      data: genres
    });
  } catch (error) {
    console.error('Error fetching genres:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
});

// Helper function to fetch local manga (is_input_manual = true) with filters
async function fetchLocalManga(filters) {
    const {
    q,
    genreArray,
    status,
    country,
    type,
    orderBy = 'Update',
    project
  } = filters;

    // Build base WHERE conditions
  const whereConditions = ['m.is_input_manual = TRUE'];
    const params = [];

    // Search filter
    if (q && q.trim()) {
      whereConditions.push('(m.title LIKE ? OR m.alternative_name LIKE ?)');
      const searchTerm = `%${q.trim()}%`;
      params.push(searchTerm, searchTerm);
    } else if (project === 'true') {
      whereConditions.push('m.is_project = TRUE');
    }

    // Status filter
    if (status && status !== 'All') {
      whereConditions.push('m.status = ?');
    params.push(status.toLowerCase());
    }

    // Country filter
    if (country) {
      whereConditions.push('m.country_id = ?');
      params.push(country);
    }

    // Type filter (content_type)
    if (type && type !== 'Comic') {
      const typeMap = {
        'Manga': 'manga',
        'Manhua': 'manhua',
        'Manhwa': 'manhwa'
      };
      if (typeMap[type]) {
        whereConditions.push('m.content_type = ?');
        params.push(typeMap[type]);
      } else if (type === 'Comic') {
        whereConditions.push('(m.content_type = ? OR m.content_type IS NULL)');
        params.push('comic');
      }
    }

    // Process genre IDs
    const genreIds = genreArray.map(g => parseInt(g)).filter(g => !isNaN(g));

  // Build query
    let query = 'SELECT DISTINCT m.* FROM manga m';
    if (genreIds.length > 0) {
      query += ' INNER JOIN manga_genres mg ON m.id = mg.manga_id';
    }
      query += ' WHERE ' + whereConditions.join(' AND ');
    if (genreIds.length > 0) {
    query += ' AND mg.category_id IN (' + genreIds.map(() => '?').join(',') + ')';
      params.push(...genreIds);
    }

    // Add GROUP BY and HAVING for genre filter
    if (genreIds.length > 0) {
      query += ' GROUP BY m.id HAVING COUNT(DISTINCT mg.category_id) = ?';
      params.push(genreIds.length);
    }

    // Ordering
    let orderClause = '';
    switch (orderBy) {
      case 'Az':
        orderClause = 'ORDER BY m.title ASC';
        break;
      case 'Za':
        orderClause = 'ORDER BY m.title DESC';
        break;
      case 'Update':
        orderClause = 'ORDER BY m.updated_at DESC';
        break;
      case 'Added':
        orderClause = 'ORDER BY m.created_at DESC';
        break;
      case 'Popular':
        orderClause = 'ORDER BY m.views DESC, m.rating DESC';
        break;
      default:
        orderClause = 'ORDER BY m.updated_at DESC';
    }
    query += ' ' + orderClause;

  // Execute query (no pagination here, we'll merge first)
    const [mangaRows] = await db.execute(query, params);

  // Transform to match WestManga API format
    const mangaList = await Promise.all(mangaRows.map(async (manga) => {
      // Get genres
      const [genres] = await db.execute(`
        SELECT c.id, c.name, c.slug
        FROM manga_genres mg
        JOIN categories c ON mg.category_id = c.id
        WHERE mg.manga_id = ?
      `, [manga.id]);

      // Get last chapter (most recent)
      const [lastChapters] = await db.execute(`
        SELECT 
          chapter_number as number,
          title,
          slug,
          created_at,
          UNIX_TIMESTAMP(created_at) as created_at_timestamp
        FROM chapters
        WHERE manga_id = ?
        ORDER BY CAST(chapter_number AS UNSIGNED) DESC, chapter_number DESC
        LIMIT 1
      `, [manga.id]);

      let coverUrl = manga.thumbnail || null;

      return {
        id: manga.id,
        title: manga.title,
        slug: manga.slug,
        alternative_name: manga.alternative_name || null,
        author: manga.author || 'Unknown',
        sinopsis: manga.synopsis || null,
        cover: coverUrl,
        content_type: manga.content_type || 'comic',
        country_id: manga.country_id || null,
        color: manga.color ? true : false,
        hot: manga.hot ? true : false,
        is_project: manga.is_project ? true : false,
        is_safe: manga.is_safe ? true : false,
        rating: parseFloat(manga.rating) || 0,
        bookmark_count: manga.bookmark_count || 0,
        total_views: manga.views || 0,
        release: manga.release || null,
        status: manga.status || 'ongoing',
        genres: genres,
        lastChapters: lastChapters.map(ch => ({
          number: ch.number,
          title: ch.title,
          slug: ch.slug,
          created_at: {
            time: parseInt(ch.created_at_timestamp)
          }
        }))
      };
    }));

  return mangaList;
}

// Get manga list with filters - merges external API with local manga (is_input_manual = true)
app.get('/api/contents', async (req, res) => {
  try {
    const {
      q, // search query
      page = 1,
      per_page = 40,
      genre, // can be array (genre[]) or single value
      status, // ongoing, completed, hiatus
      country, // JP, KR, CN, etc.
      type, // Comic, Manga, Manhwa, Manhua
      orderBy = 'Update', // Az, Za, Update, Added, Popular
      project // if 'true', filter by is_project = true
    } = req.query;

    // Handle genre parameter - can be array or single value
    let genreArray = [];
    if (genre) {
      if (Array.isArray(genre)) {
        genreArray = genre;
      } else if (typeof genre === 'object') {
        genreArray = Object.values(genre);
      } else {
        genreArray = [genre];
      }
    }

    const pageNum = parseInt(page);
    const perPage = parseInt(per_page);

    // Fetch from external API and local database in parallel
    let externalManga = [];
    let localManga = [];
    let externalPaginator = null;

    // Fetch local manga first to know how many we have
    try {
      localManga = await fetchLocalManga({
        q,
        genreArray,
        status,
        country,
        type,
        orderBy,
        project
      });
    } catch (localError) {
      console.error('Error fetching local manga:', localError);
    }

    try {
      // Fetch from external API - we need to fetch enough data to cover the requested page after merge
      // Strategy: fetch multiple pages from external API to ensure we have enough data
      // Calculate how many pages we need: (pageNum * perPage) / externalPerPage + buffer
      // Since local manga appears first, we need more external data
      const externalPerPage = 100; // Use reasonable per_page for external API
      const pagesNeeded = Math.ceil((pageNum * perPage + localManga.length + (perPage * 2)) / externalPerPage);
      const pagesToFetch = Math.min(pagesNeeded, 20); // Fetch up to 20 pages (2000 items max)
      
      // Fetch multiple pages in parallel
      const fetchPromises = [];
      for (let i = 1; i <= pagesToFetch; i++) {
        const externalParams = {
          page: i,
          per_page: externalPerPage,
          ...(q && { q }),
          ...(genreArray.length > 0 && { genre: genreArray }),
          ...(status && status !== 'All' && { status }),
          ...(country && { country }),
          ...(type && { type }),
          ...(orderBy && orderBy !== 'Update' && { orderBy }),
          ...(project === 'true' && { project })
        };
        fetchPromises.push(westMangaService.getMangaList(externalParams));
      }
      
      const externalResponses = await Promise.all(fetchPromises);
      
      // Combine all external manga data
      externalManga = [];
      for (const response of externalResponses) {
        if (response.status && response.data && Array.isArray(response.data)) {
          externalManga.push(...response.data);
          // Save paginator from first response for total calculation
          if (!externalPaginator && response.paginator) {
            externalPaginator = response.paginator;
          }
        }
      }
      
      // Get accurate total by making a separate minimal request with default per_page
      // This ensures we get the correct total count from external API
      if (!externalPaginator || externalPaginator.total === undefined) {
        try {
          const totalParams = {
            page: 1,
            per_page: 25, // Use their default per_page to get accurate paginator
            ...(q && { q }),
            ...(genreArray.length > 0 && { genre: genreArray }),
            ...(status && status !== 'All' && { status }),
            ...(country && { country }),
            ...(type && { type }),
            ...(orderBy && orderBy !== 'Update' && { orderBy }),
            ...(project === 'true' && { project })
          };
          const totalResponse = await westMangaService.getMangaList(totalParams);
          if (totalResponse.paginator) {
            externalPaginator = totalResponse.paginator;
          }
        } catch (totalError) {
          console.warn('Error fetching total from external API:', totalError.message);
        }
      }
    } catch (externalError) {
      console.warn('Error fetching from external API, continuing with local manga only:', externalError.message);
    }


    // Merge results - avoid duplicates by slug (prefer local if duplicate)
    const mangaMap = new Map();
    
    // First add external manga (mark as not local)
    externalManga.forEach(manga => {
      if (manga.slug) {
        mangaMap.set(manga.slug, { ...manga, is_local: false });
      }
    });

    // Then add local manga (will overwrite external if duplicate slug, mark as local)
    localManga.forEach(manga => {
      if (manga.slug) {
        mangaMap.set(manga.slug, { ...manga, is_local: true });
      }
    });

    // Convert to array and separate local and external
    const allManga = Array.from(mangaMap.values());
    const localMangaList = allManga.filter(m => m.is_local === true);
    const externalMangaList = allManga.filter(m => m.is_local === false);
    
    // Helper function to sort manga array
    const sortManga = (mangaArray) => {
      switch (orderBy) {
        case 'Az':
          return mangaArray.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        case 'Za':
          return mangaArray.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        case 'Update':
          return mangaArray.sort((a, b) => {
            const aTime = a.lastChapters?.[0]?.created_at?.time || 0;
            const bTime = b.lastChapters?.[0]?.created_at?.time || 0;
            return bTime - aTime;
          });
        case 'Added':
          // Use id as proxy for created_at (higher id = newer)
          return mangaArray.sort((a, b) => (b.id || 0) - (a.id || 0));
        case 'Popular':
          return mangaArray.sort((a, b) => {
            const aPopular = (a.total_views || 0) + (a.rating || 0) * 100;
            const bPopular = (b.total_views || 0) + (b.rating || 0) * 100;
            return bPopular - aPopular;
          });
        default:
          return mangaArray.sort((a, b) => {
            const aTime = a.lastChapters?.[0]?.created_at?.time || 0;
            const bTime = b.lastChapters?.[0]?.created_at?.time || 0;
            return bTime - aTime;
          });
      }
    };
    
    // Sort local manga first, then external manga
    sortManga(localMangaList);
    sortManga(externalMangaList);
    
    // Combine: local manga first, then external manga
    let mergedManga = [...localMangaList, ...externalMangaList];
    
    // Remove is_local flag before sending response (keep format consistent)
    mergedManga = mergedManga.map(manga => {
      const mangaCopy = { ...manga };
      delete mangaCopy.is_local;
      return mangaCopy;
    });

    // Apply pagination after merge
    const offset = (pageNum - 1) * perPage;
    const paginatedManga = mergedManga.slice(offset, offset + perPage);

    // Calculate total: external total + local total (local takes priority if duplicate)
    let total = 0;
    let lastPage = 1;
    
    if (externalPaginator && externalPaginator.total !== undefined) {
      // Use total from external API as base
      total = externalPaginator.total;
      
      // Count total local manga that match the filters (we can't check against all external, so count all local)
      // Since local manga takes priority, we add all local manga count
      // This might slightly overcount if there are duplicates, but it's acceptable
      total += localManga.length;
      
      // Calculate last_page based on total and our per_page
      lastPage = Math.ceil(total / perPage);
    } else {
      // Fallback: use merged count if external paginator not available
      total = mergedManga.length;
      lastPage = Math.ceil(total / perPage);
    }

    // Build paginator object
    const paginator = {
      current_page: pageNum,
      last_page: lastPage,
      per_page: perPage,
      total: total,
      from: total > 0 ? offset + 1 : 0,
      to: Math.min(offset + perPage, total)
    };

    res.json({
      status: true,
      data: paginatedManga,
      paginator: paginator
    });
  } catch (error) {
    console.error('Error fetching contents:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
});

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

app.post('/api/categories', authenticateToken, async (req, res) => {
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

app.put('/api/categories/:id', authenticateToken, async (req, res) => {
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

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
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

// Get manga detail by slug - compatible with WestManga API format
// First searches in our database, then falls back to WestManga API if not found
app.get('/api/comic/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // First, search in our database by slug
    const [rows] = await db.execute(`
      SELECT m.*
      FROM manga m
      WHERE m.slug = ?
    `, [slug]);
    
    if (rows.length > 0) {
      // Manga found in our database
      const manga = rows[0];
      
      // Only return local data if manga is_input_manual = true
      if (manga.is_input_manual) {
        // Get genres for this manga
        const [genres] = await db.execute(`
          SELECT c.id, c.name, c.slug
          FROM manga_genres mg
          JOIN categories c ON mg.category_id = c.id
          WHERE mg.manga_id = ?
        `, [manga.id]);
        
        // Get chapters from our database (only for manual input manga)
        const [chapters] = await db.execute(`
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
        `, [manga.id]);
        
        // Transform to match WestManga API format
        const mangaData = {
          id: manga.id,
          title: manga.title,
          slug: manga.slug,
          alternative_name: manga.alternative_name || null,
          author: manga.author || 'Unknown',
          sinopsis: manga.synopsis || null,
          cover: manga.thumbnail || null,
          content_type: manga.content_type || 'comic',
          country_id: manga.country_id || null,
          color: manga.color ? true : false,
          hot: manga.hot ? true : false,
          is_project: manga.is_project ? true : false,
          is_safe: manga.is_safe ? true : false,
          rating: parseFloat(manga.rating) || 0,
          bookmark_count: manga.bookmark_count || 0,
          total_views: manga.views || 0,
          release: manga.release || null,
          status: manga.status || 'ongoing',
          genres: genres,
          chapters: chapters.map(ch => ({
            id: ch.id,
            content_id: ch.content_id || ch.id,
            number: ch.number,
            title: ch.title || `Chapter ${ch.number}`,
            slug: ch.slug,
            created_at: {
              time: parseInt(ch.created_at_timestamp),
              formatted: new Date(ch.created_at).toLocaleString('id-ID')
            }
          }))
        };
        
        return res.json({
          status: true,
          data: mangaData
        });
      }
      // If manga exists but is_input_manual = false, fall through to fetch from WestManga
    }
    
    // Manga not found in our database, fetch from WestManga API
    try {
      const westMangaData = await westMangaService.getMangaChapters(slug);
      if (westMangaData.status && westMangaData.data) {
        return res.json(westMangaData);
      } else {
        return res.status(404).json({ 
          status: false, 
          error: 'Manga tidak ditemukan' 
        });
      }
    } catch (westError) {
      console.error('Error fetching from WestManga API:', westError);
      return res.status(404).json({ 
        status: false, 
        error: 'Manga tidak ditemukan' 
      });
    }
  } catch (error) {
    console.error('Error fetching manga detail:', error);
    res.status(500).json({ 
      status: false, 
      error: 'Internal server error' 
    });
  }
});

// Increment view counter by manga slug
// Called when user reads a chapter
// Only updates views for manga that exist in our local database
app.post('/api/comic/:slug/view', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Find manga by slug (only local manga can be updated)
    const [rows] = await db.execute(`
      SELECT id, views
      FROM manga
      WHERE slug = ?
    `, [slug]);
    
    if (rows.length === 0) {
      // Manga not found in local database (might be from WestManga)
      // Return success but don't update (views are tracked on WestManga side)
      return res.json({
        status: true,
        data: {
          slug: slug,
          views: null,
          message: 'Manga not in local database, view not tracked'
        }
      });
    }
    
    const manga = rows[0];
    const currentViews = manga.views || 0;
    const newViews = currentViews + 1;
    
    // Update views counter
    await db.execute(`
      UPDATE manga 
      SET views = ?
      WHERE id = ?
    `, [newViews, manga.id]);
    
    res.json({
      status: true,
      data: {
        slug: slug,
        views: newViews,
        previous_views: currentViews
      },
      message: 'View counter updated successfully'
    });
  } catch (error) {
    console.error('Error incrementing view counter:', error);
    res.status(500).json({ 
      status: false, 
      error: 'Internal server error' 
    });
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

app.post('/api/manga', authenticateToken, upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'cover_background', maxCount: 1 }
]), async (req, res) => {
  try {
    const { 
      title, author, synopsis, category_id, genre_ids,
      alternative_name, content_type, country_id, release, status, rating, color
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
        alternative_name, content_type, country_id, \`release\`, status, rating, color, is_input_manual
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title, slug, author, synopsis, category_id, thumbnail, cover_background,
      alternative_name || null, content_type || 'manga', country_id || null,
      release || null, status || 'ongoing', rating ? parseFloat(rating) : null,
      color === 'true' || color === true ? true : false, true // is_input_manual = true for manual input
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

app.put('/api/manga/:id', authenticateToken, upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'cover_background', maxCount: 1 }
]), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, author, synopsis, category_id, genre_ids,
      alternative_name, content_type, country_id, release, status, rating, color
    } = req.body;
    const slug = generateSlug(title);
    
    // Check if slug already exists for other manga
    const [existing] = await db.execute('SELECT id FROM manga WHERE slug = ? AND id != ?', [slug, id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Manga dengan judul serupa sudah ada' });
    }
    
    let query = `UPDATE manga SET 
      title = ?, slug = ?, author = ?, synopsis = ?, category_id = ?,
      alternative_name = ?, content_type = ?, country_id = ?, \`release\` = ?, status = ?, rating = ?, color = ?`;
    let params = [
      title, slug, author, synopsis, category_id,
      alternative_name || null, content_type || 'manga', country_id || null,
      release || null, status || 'ongoing', rating ? parseFloat(rating) : null,
      color === 'true' || color === true ? true : false
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

app.delete('/api/manga/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get manga info to check if it's manual and get file paths
    const [mangaRows] = await db.execute(
      'SELECT thumbnail, cover_background, is_input_manual FROM manga WHERE id = ?',
      [id]
    );
    
    if (mangaRows.length === 0) {
      return res.status(404).json({ error: 'Manga not found' });
    }
    
    const manga = mangaRows[0];
    
    // Only delete files if it's a manual manga
    if (manga.is_input_manual) {
      // Delete thumbnail and cover_background files
      deleteFile(manga.thumbnail);
      deleteFile(manga.cover_background);
      
      // Get all chapters for this manga
      const [chapters] = await db.execute(
        'SELECT id, cover FROM chapters WHERE manga_id = ?',
        [id]
      );
      
      // Delete chapter cover files and get all chapter images
      for (const chapter of chapters) {
        deleteFile(chapter.cover);
        
        // Get all images for this chapter
        const [images] = await db.execute(
          'SELECT image_path FROM chapter_images WHERE chapter_id = ?',
          [chapter.id]
        );
        
        // Delete all chapter image files
        for (const image of images) {
          deleteFile(image.image_path);
        }
      }
    }
    
    // Delete from database (CASCADE will handle chapters and images)
    await db.execute('DELETE FROM manga WHERE id = ?', [id]);
    res.json({ message: 'Manga deleted successfully' });
  } catch (error) {
    console.error('Error deleting manga:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Votes Routes
// Get vote counts by manga slug
app.get('/api/votes/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const user_ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    
    // Find manga by slug
    const [mangaRows] = await db.execute(
      'SELECT id FROM manga WHERE slug = ?',
      [slug]
    );
    
    if (mangaRows.length === 0) {
      return res.status(404).json({ status: false, error: 'Manga not found' });
    }
    
    const mangaId = mangaRows[0].id;
    
    // Get vote counts grouped by vote_type
    const [votes] = await db.execute(
      `SELECT vote_type, COUNT(*) as count 
       FROM votes 
       WHERE manga_id = ? 
       GROUP BY vote_type`,
      [mangaId]
    );
    
    // Get current user's vote (if any)
    const [userVote] = await db.execute(
      'SELECT vote_type FROM votes WHERE manga_id = ? AND user_ip = ?',
      [mangaId, user_ip]
    );
    
    // Format response with default values
    const voteCounts = {
      senang: 0,
      biasaAja: 0,
      kecewa: 0,
      marah: 0,
      sedih: 0
    };
    
    votes.forEach(vote => {
      if (voteCounts.hasOwnProperty(vote.vote_type)) {
        voteCounts[vote.vote_type] = vote.count;
      }
    });
    
    res.json({
      status: true,
      data: voteCounts,
      userVote: userVote.length > 0 ? userVote[0].vote_type : null
    });
  } catch (error) {
    console.error('Error fetching votes:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
});

// Submit vote by manga slug
app.post('/api/votes', async (req, res) => {
  try {
    const { slug, vote_type } = req.body;
    
    if (!slug || !vote_type) {
      return res.status(400).json({ status: false, error: 'Slug and vote_type are required' });
    }
    
    // Validate vote_type
    const validVoteTypes = ['senang', 'biasaAja', 'kecewa', 'marah', 'sedih'];
    if (!validVoteTypes.includes(vote_type)) {
      return res.status(400).json({ status: false, error: 'Invalid vote_type' });
    }
    
    const user_ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    
    // Find manga by slug
    const [mangaRows] = await db.execute(
      'SELECT id FROM manga WHERE slug = ?',
      [slug]
    );
    
    if (mangaRows.length === 0) {
      return res.status(404).json({ status: false, error: 'Manga not found' });
    }
    
    const mangaId = mangaRows[0].id;
    
    // Check if user already voted for this manga
    const [existing] = await db.execute(
      'SELECT id, vote_type FROM votes WHERE manga_id = ? AND user_ip = ?',
      [mangaId, user_ip]
    );
    
    if (existing.length > 0) {
      // User already voted, update the vote
      if (existing[0].vote_type === vote_type) {
        // Same vote type, remove vote (unvote)
        await db.execute(
          'DELETE FROM votes WHERE id = ?',
          [existing[0].id]
        );
        return res.json({ 
          status: true, 
          message: 'Vote removed successfully',
          action: 'removed'
        });
      } else {
        // Different vote type, update vote
        await db.execute(
          'UPDATE votes SET vote_type = ? WHERE id = ?',
          [vote_type, existing[0].id]
        );
        return res.json({ 
          status: true, 
          message: 'Vote updated successfully',
          action: 'updated',
          previous_vote: existing[0].vote_type,
          new_vote: vote_type
        });
      }
    } else {
      // New vote
      await db.execute(
        'INSERT INTO votes (manga_id, vote_type, user_ip) VALUES (?, ?, ?)',
        [mangaId, vote_type, user_ip]
      );
      return res.json({ 
        status: true, 
        message: 'Vote recorded successfully',
        action: 'added'
      });
    }
  } catch (error) {
    console.error('Error recording vote:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
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

app.post('/api/manga/:mangaId/chapters', authenticateToken, upload.single('cover'), async (req, res) => {
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

app.put('/api/chapters/:id', authenticateToken, upload.single('cover'), async (req, res) => {
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

app.delete('/api/chapters/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get chapter info to get file paths
    const [chapterRows] = await db.execute(
      'SELECT cover, manga_id FROM chapters WHERE id = ?',
      [id]
    );
    
    if (chapterRows.length === 0) {
      return res.status(404).json({ error: 'Chapter not found' });
    }
    
    const chapter = chapterRows[0];
    
    // Check if manga is manual input
    const [mangaRows] = await db.execute(
      'SELECT is_input_manual FROM manga WHERE id = ?',
      [chapter.manga_id]
    );
    
    // Only delete files if manga is manual
    if (mangaRows.length > 0 && mangaRows[0].is_input_manual) {
      // Delete chapter cover file
      deleteFile(chapter.cover);
      
      // Get all images for this chapter
      const [images] = await db.execute(
        'SELECT image_path FROM chapter_images WHERE chapter_id = ?',
        [id]
      );
      
      // Delete all chapter image files
      for (const image of images) {
        deleteFile(image.image_path);
      }
    }
    
    // Delete from database (CASCADE will handle images)
    await db.execute('DELETE FROM chapters WHERE id = ?', [id]);
    res.json({ message: 'Chapter deleted successfully' });
  } catch (error) {
    console.error('Error deleting chapter:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Chapter Images Routes
app.get('/api/chapters/:chapterId/images', async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    const [images] = await db.execute(
      'SELECT id, image_path, page_number, created_at FROM chapter_images WHERE chapter_id = ? ORDER BY page_number',
      [chapterId]
    );
    
    res.json(images);
  } catch (error) {
    console.error('Error fetching chapter images:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/chapters/:chapterId/images', authenticateToken, upload.array('images', 50), async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }
    
    // Get current max page_number for this chapter
    const [maxPage] = await db.execute(
      'SELECT COALESCE(MAX(page_number), 0) as max_page FROM chapter_images WHERE chapter_id = ?',
      [chapterId]
    );
    
    const startPageNumber = maxPage[0].max_page + 1;
    
    const insertPromises = req.files.map((file, index) => {
      return db.execute(
        'INSERT INTO chapter_images (chapter_id, image_path, page_number) VALUES (?, ?, ?)',
        [chapterId, `/uploads/${file.filename}`, startPageNumber + index]
      );
    });
    
    await Promise.all(insertPromises);
    
    res.status(201).json({ message: 'Images uploaded successfully' });
  } catch (error) {
    console.error('Error uploading chapter images:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/chapters/:chapterId/images/:imageId', authenticateToken, async (req, res) => {
  try {
    const { chapterId, imageId } = req.params;
    
    // Verify the image belongs to the chapter
    const [images] = await db.execute(
      'SELECT id, image_path FROM chapter_images WHERE id = ? AND chapter_id = ?',
      [imageId, chapterId]
    );
    
    if (images.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const imagePath = images[0].image_path;
    
    // Check if manga is manual input
    const [mangaRows] = await db.execute(
      `SELECT m.is_input_manual 
       FROM manga m 
       JOIN chapters c ON m.id = c.manga_id 
       WHERE c.id = ?`,
      [chapterId]
    );
    
    // Only delete file if manga is manual
    if (mangaRows.length > 0 && mangaRows[0].is_input_manual) {
      deleteFile(imagePath);
    }
    
    // Delete from database
    await db.execute('DELETE FROM chapter_images WHERE id = ?', [imageId]);
    
    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting chapter image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dashboard Stats Route
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    // Get total manga count
    const [mangaCount] = await db.execute('SELECT COUNT(*) as total FROM manga');
    
    // Get total categories count
    const [categoryCount] = await db.execute('SELECT COUNT(*) as total FROM categories');
    
    // Get total views (sum of all manga views)
    const [viewsResult] = await db.execute('SELECT COALESCE(SUM(views), 0) as total FROM manga');
    
    // Get total ads count
    const [adsCount] = await db.execute('SELECT COUNT(*) as total FROM ads');
    
    res.json({
      totalManga: mangaCount[0].total,
      totalCategories: categoryCount[0].total,
      totalViews: viewsResult[0].total,
      totalAds: adsCount[0].total
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Featured Items Routes
app.get('/api/featured-items', async (req, res) => {
  try {
    const { type, active } = req.query;
    
    let query = `
      SELECT 
        fi.*,
        m.id as manga_id,
        m.title,
        m.slug,
        m.thumbnail as cover,
        m.alternative_name,
        m.author,
        m.synopsis,
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
        m.status,
        m.is_input_manual,
        m.westmanga_id
      FROM featured_items fi
      JOIN manga m ON fi.manga_id = m.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (type) {
      query += ' AND fi.featured_type = ?';
      params.push(type);
    }
    
    if (active !== undefined && active !== '') {
      query += ' AND fi.is_active = ?';
      params.push(active === 'true');
    }
    
    query += ' ORDER BY fi.display_order ASC, fi.created_at DESC';
    
    const [items] = await db.execute(query, params);
    
    // Get genres for each manga
    for (const item of items) {
      const [genres] = await db.execute(`
        SELECT c.id, c.name, c.slug
        FROM manga_genres mg
        JOIN categories c ON mg.category_id = c.id
        WHERE mg.manga_id = ?
      `, [item.manga_id]);
      item.genres = genres;
      
      // Get last chapter for each manga
      const [lastChapters] = await db.execute(`
        SELECT 
          chapter_number as number,
          title,
          slug,
          created_at,
          UNIX_TIMESTAMP(created_at) as created_at_timestamp
        FROM chapters
        WHERE manga_id = ?
        ORDER BY CAST(chapter_number AS UNSIGNED) DESC, chapter_number DESC
        LIMIT 1
      `, [item.manga_id]);
      
      item.lastChapters = lastChapters.map(ch => ({
        number: ch.number,
        title: ch.title,
        slug: ch.slug,
        created_at: {
          time: parseInt(ch.created_at_timestamp)
        }
      }));
    }
    
    res.json(items);
  } catch (error) {
    console.error('Error fetching featured items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/featured-items', authenticateToken, async (req, res) => {
  try {
    let { manga_id, featured_type, display_order, is_active = true, westmanga_id } = req.body;
    
    // Handle display_order: null or undefined becomes 0
    if (display_order === null || display_order === undefined) {
      display_order = 0;
    }
    
    if (!manga_id || !featured_type) {
      return res.status(400).json({ error: 'manga_id and featured_type are required' });
    }
    
    // Check if manga exists by id first
    let [mangaCheck] = await db.execute('SELECT id FROM manga WHERE id = ?', [manga_id]);
    
    // If not found and westmanga_id is provided, try to find by westmanga_id
    if (mangaCheck.length === 0 && westmanga_id) {
      [mangaCheck] = await db.execute('SELECT id FROM manga WHERE westmanga_id = ?', [westmanga_id]);
      
      // If still not found, return error
      if (mangaCheck.length === 0) {
        return res.status(404).json({ 
          error: 'Manga not found. Please sync the manga from WestManga first.' 
        });
      }
      
      // Use the local manga id found by westmanga_id
      manga_id = mangaCheck[0].id;
    } else if (mangaCheck.length === 0) {
      return res.status(404).json({ error: 'Manga not found' });
    }
    
    // Check if combination already exists (unique constraint)
    const [existing] = await db.execute(
      'SELECT id FROM featured_items WHERE manga_id = ? AND featured_type = ?',
      [manga_id, featured_type]
    );
    
    if (existing.length > 0) {
      // Update existing instead
      await db.execute(
        'UPDATE featured_items SET display_order = ?, is_active = ? WHERE id = ?',
        [display_order, is_active, existing[0].id]
      );
      return res.json({ id: existing[0].id, message: 'Featured item updated successfully' });
    }
    
    const [result] = await db.execute(
      'INSERT INTO featured_items (manga_id, featured_type, display_order, is_active) VALUES (?, ?, ?, ?)',
      [manga_id, featured_type, display_order, is_active]
    );
    
    res.status(201).json({ id: result.insertId, message: 'Featured item created successfully' });
  } catch (error) {
    console.error('Error creating featured item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/featured-items/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { manga_id, featured_type, display_order, is_active } = req.body;
    
    const updates = [];
    const params = [];
    
    if (manga_id !== undefined) {
      updates.push('manga_id = ?');
      params.push(manga_id);
    }
    
    if (featured_type !== undefined) {
      updates.push('featured_type = ?');
      params.push(featured_type);
    }
    
    if (display_order !== undefined) {
      // Handle null/empty display_order: convert to 0
      const orderValue = display_order === null || display_order === '' ? 0 : display_order;
      updates.push('display_order = ?');
      params.push(orderValue);
    }
    
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(id);
    
    await db.execute(
      `UPDATE featured_items SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    res.json({ message: 'Featured item updated successfully' });
  } catch (error) {
    console.error('Error updating featured item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/featured-items/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM featured_items WHERE id = ?', [id]);
    res.json({ message: 'Featured item deleted successfully' });
  } catch (error) {
    console.error('Error deleting featured item:', error);
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

app.post('/api/ads', authenticateToken, upload.single('image'), async (req, res) => {
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

app.put('/api/ads/:id', authenticateToken, upload.single('image'), async (req, res) => {
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

app.delete('/api/ads/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM ads WHERE id = ?', [id]);
    res.json({ message: 'Ad deleted successfully' });
  } catch (error) {
    console.error('Error deleting ad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Contact Info Routes
app.get('/api/contact-info', async (req, res) => {
  try {
    const { active } = req.query;
    
    let query = 'SELECT * FROM contact_info WHERE 1=1';
    const params = [];
    
    if (active !== undefined && active !== '') {
      query += ' AND is_active = ?';
      params.push(active === 'true');
    }
    
    query += ' ORDER BY created_at DESC LIMIT 1';
    
    const [contactInfo] = await db.execute(query, params);
    
    if (contactInfo.length === 0) {
      return res.json(null);
    }
    
    res.json(contactInfo[0]);
  } catch (error) {
    console.error('Error fetching contact info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/contact-info', authenticateToken, async (req, res) => {
  try {
    const { email, whatsapp, description, is_active = true } = req.body;
    
    if (!email || !whatsapp) {
      return res.status(400).json({ error: 'Email and WhatsApp are required' });
    }
    
    // Delete existing active contact info (only one active at a time)
    await db.execute('UPDATE contact_info SET is_active = FALSE WHERE is_active = TRUE');
    
    const [result] = await db.execute(
      'INSERT INTO contact_info (email, whatsapp, description, is_active) VALUES (?, ?, ?, ?)',
      [email, whatsapp, description || null, is_active]
    );
    
    res.status(201).json({ id: result.insertId, message: 'Contact info created successfully' });
  } catch (error) {
    console.error('Error creating contact info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/contact-info/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, whatsapp, description, is_active } = req.body;
    
    const updates = [];
    const params = [];
    
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }
    
    if (whatsapp !== undefined) {
      updates.push('whatsapp = ?');
      params.push(whatsapp);
    }
    
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    
    if (is_active !== undefined) {
      // If setting to active, deactivate all others first
      if (is_active) {
        await db.execute('UPDATE contact_info SET is_active = FALSE WHERE id != ?', [id]);
      }
      updates.push('is_active = ?');
      params.push(is_active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(id);
    
    await db.execute(
      `UPDATE contact_info SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    res.json({ message: 'Contact info updated successfully' });
  } catch (error) {
    console.error('Error updating contact info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/contact-info/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM contact_info WHERE id = ?', [id]);
    res.json({ message: 'Contact info deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact info:', error);
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

// Helper function to send SSE message
const sendSSE = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

// Sync manga from WestManga to our database - FULL SYNC (with chapters and images)
app.post('/api/westmanga/sync', authenticateToken, async (req, res) => {
  const useSSE = req.headers.accept && req.headers.accept.includes('text/event-stream');
  
  // Set headers for SSE if requested
  if (useSSE) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  }
  
  try {
    const { page = 1, limit = 25, syncChapters = true, syncImages = true } = req.body;
    
    const totalItems = limit;
    let processedItems = 0;
    
    // Send initial progress
    if (useSSE) {
      sendSSE(res, 'progress', {
        status: 'starting',
        message: 'Memulai sinkronisasi...',
        processed: 0,
        total: totalItems,
        percentage: 0
      });
    }
    
    // First, sync genres to categories table
    try {
      if (useSSE) {
        sendSSE(res, 'progress', {
          status: 'syncing_genres',
          message: 'Menyinkronkan genre...',
          processed: 0,
          total: totalItems,
          percentage: 0
        });
      }
      
      const genresData = await westMangaService.getGenres();
      if (genresData.status && genresData.data && Array.isArray(genresData.data)) {
        for (const genre of genresData.data) {
          // Check if category exists
          const [existing] = await db.execute(
            'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) OR LOWER(slug) = LOWER(?)',
            [genre.name, genre.slug]
          );
          
          if (existing.length === 0) {
            // Insert new category
            await db.execute(
              'INSERT INTO categories (name, slug) VALUES (?, ?)',
              [genre.name, genre.slug]
            );
          }
        }
      }
    } catch (genreError) {
      console.error('Error syncing genres:', genreError);
      // Continue even if genre sync fails
    }
    
    // Fetch manga list from WestManga
    if (useSSE) {
      sendSSE(res, 'progress', {
        status: 'fetching',
        message: 'Mengambil data dari WestManga...',
        processed: 0,
        total: totalItems,
        percentage: 0
      });
    }
    
    const westMangaData = await westMangaService.getMangaList({ 
      page, 
      per_page: limit 
    });
    
    if (!westMangaData.status || !westMangaData.data) {
      if (useSSE) {
        sendSSE(res, 'error', { error: 'Failed to fetch data from WestManga' });
        res.end();
      } else {
        return res.status(400).json({ error: 'Failed to fetch data from WestManga' });
      }
      return;
    }
    
    let syncedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    let chaptersSynced = 0;
    let imagesSynced = 0;
    
    for (const mangaData of westMangaData.data) {
      processedItems++;
      const percentage = Math.round((processedItems / totalItems) * 100);
      
      if (useSSE) {
        sendSSE(res, 'progress', {
          status: 'processing',
          message: `Memproses: ${mangaData.title || mangaData.slug}`,
          processed: processedItems,
          total: totalItems,
          percentage: percentage,
          currentManga: mangaData.title || mangaData.slug
        });
      }
      try {
        let mangaId;
        
        // Check if manga already exists
        const [existing] = await db.execute(
          'SELECT id FROM manga WHERE westmanga_id = ?',
          [mangaData.id]
        );
        
        if (existing.length > 0) {
          // Update existing manga
          mangaId = existing[0].id;
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
          
          updatedCount++;
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
          
          mangaId = result.insertId;
          syncedCount++;
        }
        
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
        
        // Sync chapters if enabled
        if (syncChapters && mangaId) {
          try {
            // Get manga detail with chapters from /api/comic/[slug]
            const mangaDetail = await westMangaService.getMangaChapters(mangaData.slug);
            
            // Also sync genres from detail if available
            if (mangaDetail.status && mangaDetail.data && mangaDetail.data.genres) {
              const detailGenres = mangaDetail.data.genres;
              for (const genre of detailGenres) {
                const [category] = await db.execute(
                  'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)',
                  [genre.name]
                );
                
                if (category.length > 0) {
                  await db.execute(`
                    INSERT IGNORE INTO manga_genres (manga_id, category_id)
                    VALUES (?, ?)
                  `, [mangaId, category[0].id]);
                }
              }
            }
            
            if (mangaDetail.status && mangaDetail.data && mangaDetail.data.chapters) {
              const chapters = mangaDetail.data.chapters;
              
              for (const chapterData of chapters) {
                try {
                  // Check if chapter already exists
                  const [existingChapter] = await db.execute(
                    'SELECT id FROM chapters WHERE westmanga_chapter_id = ? OR (manga_id = ? AND chapter_number = ?)',
                    [chapterData.id, mangaId, chapterData.number]
                  );
                  
                  let chapterId;
                  
                  if (existingChapter.length > 0) {
                    // Update existing chapter
                    chapterId = existingChapter[0].id;
                    const transformed = westMangaService.transformChapterData(chapterData);
                    await db.execute(`
                      UPDATE chapters SET 
                        title = ?, slug = ?, chapter_number = ?, updated_at = CURRENT_TIMESTAMP
                      WHERE id = ?
                    `, [transformed.title, transformed.slug, transformed.chapter_number, chapterId]);
                  } else {
                    // Insert new chapter
                    const transformed = westMangaService.transformChapterData(chapterData);
                    const [chapterResult] = await db.execute(`
                      INSERT INTO chapters (westmanga_chapter_id, manga_id, title, slug, chapter_number, created_at)
                      VALUES (?, ?, ?, ?, ?, ?)
                    `, [
                      transformed.westmanga_chapter_id,
                      mangaId,
                      transformed.title,
                      transformed.slug,
                      transformed.chapter_number,
                      transformed.created_at
                    ]);
                    
                    chapterId = chapterResult.insertId;
                    chaptersSynced++;
                  }
                  
                  // Sync images if enabled
                  if (syncImages && chapterId && chapterData.slug) {
                    try {
                      // Get chapter images from /api/v/[chapter-slug]
                      const chapterImagesData = await westMangaService.getChapterImages(chapterData.slug);
                      
                      if (chapterImagesData.status && chapterImagesData.data && chapterImagesData.data.images) {
                        const images = chapterImagesData.data.images;
                        
                        // Check existing images count
                        const [existingImages] = await db.execute(
                          'SELECT COUNT(*) as count FROM chapter_images WHERE chapter_id = ?',
                          [chapterId]
                        );
                        
                        // Only sync if no images exist (to avoid re-downloading)
                        if (existingImages[0].count === 0 && Array.isArray(images)) {
                          for (let i = 0; i < images.length; i++) {
                            const imageUrl = images[i];
                            if (imageUrl && typeof imageUrl === 'string') {
                              await db.execute(`
                                INSERT INTO chapter_images (chapter_id, image_path, page_number)
                                VALUES (?, ?, ?)
                              `, [chapterId, imageUrl, i + 1]);
                              imagesSynced++;
                            }
                          }
                        }
                      }
                    } catch (imageError) {
                      console.error(`Error syncing images for chapter ${chapterData.slug}:`, imageError.message);
                      // Continue with next chapter
                    }
                  }
                } catch (chapterError) {
                  console.error(`Error syncing chapter ${chapterData.slug}:`, chapterError.message);
                  // Continue with next chapter
                }
              }
            }
          } catch (chaptersError) {
            console.error(`Error fetching chapters for manga ${mangaData.slug}:`, chaptersError.message);
            // Continue with next manga
          }
        }
      } catch (itemError) {
        console.error(`Error syncing manga ${mangaData.slug}:`, itemError);
        errorCount++;
        
        if (useSSE) {
          sendSSE(res, 'progress', {
            status: 'error',
            message: `Error: ${mangaData.title || mangaData.slug}`,
            processed: processedItems,
            total: totalItems,
            percentage: percentage,
            error: itemError.message
          });
        }
      }
    }
    
    const finalResult = {
      message: 'Sync completed',
      status: 'complete',
      synced: syncedCount,
      updated: updatedCount,
      errors: errorCount,
      chaptersSynced: chaptersSynced,
      imagesSynced: imagesSynced,
      total: westMangaData.data.length,
      processed: processedItems,
      percentage: 100
    };
    
    if (useSSE) {
      // Send final progress update
      sendSSE(res, 'progress', finalResult);
      // Send complete event
      sendSSE(res, 'complete', finalResult);
      res.end();
    } else {
      res.json(finalResult);
    }
  } catch (error) {
    console.error('Error syncing WestManga data:', error);
    
    if (useSSE) {
      sendSSE(res, 'error', { error: 'Failed to sync manga from WestManga', details: error.message });
      res.end();
    } else {
      res.status(500).json({ error: 'Failed to sync manga from WestManga' });
    }
  }
});

// Sync manga from WestManga to our database - ONLY MANGA (no chapters/images)
app.post('/api/westmanga/sync-manga-only', authenticateToken, async (req, res) => {
  const useSSE = req.headers.accept && req.headers.accept.includes('text/event-stream');
  
  // Set headers for SSE if requested
  if (useSSE) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  }
  
  try {
    const { page = 1, limit = 25 } = req.body;
    
    const totalItems = limit;
    let processedItems = 0;
    
    // Send initial progress
    if (useSSE) {
      sendSSE(res, 'progress', {
        status: 'starting',
        message: 'Memulai sinkronisasi manga...',
        processed: 0,
        total: totalItems,
        percentage: 0
      });
    }
    
    // First, sync genres to categories table
    try {
      if (useSSE) {
        sendSSE(res, 'progress', {
          status: 'syncing_genres',
          message: 'Menyinkronkan genre...',
          processed: 0,
          total: totalItems,
          percentage: 0
        });
      }
      
      const genresData = await westMangaService.getGenres();
      if (genresData.status && genresData.data && Array.isArray(genresData.data)) {
        for (const genre of genresData.data) {
          // Check if category exists
          const [existing] = await db.execute(
            'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) OR LOWER(slug) = LOWER(?)',
            [genre.name, genre.slug]
          );
          
          if (existing.length === 0) {
            // Insert new category
            await db.execute(
              'INSERT INTO categories (name, slug) VALUES (?, ?)',
              [genre.name, genre.slug]
            );
          }
        }
      }
    } catch (genreError) {
      console.error('Error syncing genres:', genreError);
      // Continue even if genre sync fails
    }
    
    // Fetch manga list from WestManga
    if (useSSE) {
      sendSSE(res, 'progress', {
        status: 'fetching',
        message: 'Mengambil data dari WestManga...',
        processed: 0,
        total: totalItems,
        percentage: 0
      });
    }
    
    const westMangaData = await westMangaService.getMangaList({ 
      page, 
      per_page: limit 
    });
    
    if (!westMangaData.status || !westMangaData.data) {
      if (useSSE) {
        sendSSE(res, 'error', { error: 'Failed to fetch data from WestManga' });
        res.end();
      } else {
        return res.status(400).json({ error: 'Failed to fetch data from WestManga' });
      }
      return;
    }
    
    let syncedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const mangaData of westMangaData.data) {
      processedItems++;
      const percentage = Math.round((processedItems / totalItems) * 100);
      
      if (useSSE) {
        sendSSE(res, 'progress', {
          status: 'processing',
          message: `Memproses: ${mangaData.title || mangaData.slug}`,
          processed: processedItems,
          total: totalItems,
          percentage: percentage,
          currentManga: mangaData.title || mangaData.slug
        });
      }
      try {
        let mangaId;
        
        // Check if manga already exists
        const [existing] = await db.execute(
          'SELECT id FROM manga WHERE westmanga_id = ?',
          [mangaData.id]
        );
        
        if (existing.length > 0) {
          // Update existing manga
          mangaId = existing[0].id;
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
          
          updatedCount++;
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
          
          mangaId = result.insertId;
          syncedCount++;
        }
        
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
        
        // Also try to get genres from manga detail if available
        try {
          const mangaDetail = await westMangaService.getMangaChapters(mangaData.slug);
          
          if (mangaDetail.status && mangaDetail.data && mangaDetail.data.genres) {
            const detailGenres = mangaDetail.data.genres;
            for (const genre of detailGenres) {
              const [category] = await db.execute(
                'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)',
                [genre.name]
              );
              
              if (category.length > 0) {
                await db.execute(`
                  INSERT IGNORE INTO manga_genres (manga_id, category_id)
                  VALUES (?, ?)
                `, [mangaId, category[0].id]);
              }
            }
          }
        } catch (detailError) {
          // Silently continue if detail fetch fails
          console.error(`Error fetching detail for ${mangaData.slug}:`, detailError.message);
        }
      } catch (itemError) {
        console.error(`Error syncing manga ${mangaData.slug}:`, itemError);
        errorCount++;
        
        if (useSSE) {
          sendSSE(res, 'progress', {
            status: 'error',
            message: `Error: ${mangaData.title || mangaData.slug}`,
            processed: processedItems,
            total: totalItems,
            percentage: percentage,
            error: itemError.message
          });
        }
      }
    }
    
    const finalResult = {
      message: 'Sync manga completed',
      status: 'complete',
      synced: syncedCount,
      updated: updatedCount,
      errors: errorCount,
      total: westMangaData.data.length,
      processed: processedItems,
      percentage: 100
    };
    
    if (useSSE) {
      // Send final progress update
      sendSSE(res, 'progress', finalResult);
      // Send complete event
      sendSSE(res, 'complete', finalResult);
      res.end();
    } else {
      res.json(finalResult);
    }
  } catch (error) {
    console.error('Error syncing manga from WestManga:', error);
    
    if (useSSE) {
      sendSSE(res, 'error', { error: 'Failed to sync manga from WestManga', details: error.message });
      res.end();
    } else {
      res.status(500).json({ error: 'Failed to sync manga from WestManga' });
    }
  }
});

// Sync chapters for a specific manga by slug (WestManga only)
app.post('/api/westmanga/sync-chapters/:slug', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Find manga by slug
    const [mangaRows] = await db.execute(
      'SELECT id, slug, is_input_manual FROM manga WHERE slug = ?',
      [slug]
    );
    
    if (mangaRows.length === 0) {
      return res.status(404).json({ 
        error: 'Manga not found',
        message: `Manga with slug "${slug}" tidak ditemukan di database. Silakan sync manga terlebih dahulu.`
      });
    }
    
    const manga = mangaRows[0];
    
    // Only sync chapters for WestManga manga (is_input_manual = false)
    if (manga.is_input_manual) {
      return res.status(400).json({ 
        error: 'Invalid manga type',
        message: 'Manga ini adalah manual input. Sync chapters hanya untuk manga dari WestManga.'
      });
    }
    
    // Fetch chapters from WestManga API
    let mangaDetail;
    try {
      mangaDetail = await westMangaService.getMangaChapters(slug);
    } catch (westError) {
      console.error(`Error fetching chapters from WestManga for ${slug}:`, westError);
      return res.status(500).json({ 
        error: 'Failed to fetch chapters',
        message: `Gagal mengambil data chapter dari WestManga: ${westError.message}`
      });
    }
    
    if (!mangaDetail.status || !mangaDetail.data) {
      return res.status(404).json({ 
        error: 'Chapters not found',
        message: 'Data chapter tidak ditemukan dari WestManga API'
      });
    }
    
    const chapters = mangaDetail.data.chapters || [];
    let syncedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    // Sync each chapter
    for (const chapterData of chapters) {
      try {
        // Check if chapter already exists
        const [existingChapter] = await db.execute(
          'SELECT id FROM chapters WHERE westmanga_chapter_id = ? OR (manga_id = ? AND chapter_number = ?)',
          [chapterData.id, manga.id, chapterData.number]
        );
        
        if (existingChapter.length > 0) {
          // Update existing chapter
          const transformed = westMangaService.transformChapterData(chapterData);
          await db.execute(`
            UPDATE chapters SET 
              title = ?, slug = ?, chapter_number = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [transformed.title, transformed.slug, transformed.chapter_number, existingChapter[0].id]);
          updatedCount++;
        } else {
          // Insert new chapter
          const transformed = westMangaService.transformChapterData(chapterData);
          await db.execute(`
            INSERT INTO chapters (westmanga_chapter_id, manga_id, title, slug, chapter_number, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            transformed.westmanga_chapter_id,
            manga.id,
            transformed.title,
            transformed.slug,
            transformed.chapter_number,
            transformed.created_at
          ]);
          syncedCount++;
        }
      } catch (chapterError) {
        console.error(`Error syncing chapter ${chapterData.slug}:`, chapterError);
        errorCount++;
      }
    }
    
    res.json({
      status: 'success',
      message: 'Chapters synced successfully',
      manga_slug: slug,
      manga_id: manga.id,
      synced: syncedCount,
      updated: updatedCount,
      errors: errorCount,
      total: chapters.length
    });
  } catch (error) {
    console.error('Error syncing chapters:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Sync manga from WestManga to our database - MANGA + CHAPTERS + GENRES (no images)
app.post('/api/westmanga/sync-manga-chapters', authenticateToken, async (req, res) => {
  const useSSE = req.headers.accept && req.headers.accept.includes('text/event-stream');
  
  // Set headers for SSE if requested
  if (useSSE) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  }
  
  try {
    const { page = 1, limit = 25 } = req.body;
    
    const totalItems = limit;
    let processedItems = 0;
    
    // Send initial progress
    if (useSSE) {
      sendSSE(res, 'progress', {
        status: 'starting',
        message: 'Memulai sinkronisasi manga dan chapter...',
        processed: 0,
        total: totalItems,
        percentage: 0
      });
    }
    
    // First, sync genres to categories table
    try {
      if (useSSE) {
        sendSSE(res, 'progress', {
          status: 'syncing_genres',
          message: 'Menyinkronkan genre...',
          processed: 0,
          total: totalItems,
          percentage: 0
        });
      }
      
      const genresData = await westMangaService.getGenres();
      if (genresData.status && genresData.data && Array.isArray(genresData.data)) {
        for (const genre of genresData.data) {
          // Check if category exists
          const [existing] = await db.execute(
            'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) OR LOWER(slug) = LOWER(?)',
            [genre.name, genre.slug]
          );
          
          if (existing.length === 0) {
            // Insert new category
            await db.execute(
              'INSERT INTO categories (name, slug) VALUES (?, ?)',
              [genre.name, genre.slug]
            );
          }
        }
      }
    } catch (genreError) {
      console.error('Error syncing genres:', genreError);
      // Continue even if genre sync fails
    }
    
    // Fetch manga list from WestManga
    if (useSSE) {
      sendSSE(res, 'progress', {
        status: 'fetching',
        message: 'Mengambil data dari WestManga...',
        processed: 0,
        total: totalItems,
        percentage: 0
      });
    }
    
    const westMangaData = await westMangaService.getMangaList({ 
      page, 
      per_page: limit 
    });
    
    if (!westMangaData.status || !westMangaData.data) {
      if (useSSE) {
        sendSSE(res, 'error', { error: 'Failed to fetch data from WestManga' });
        res.end();
      } else {
        return res.status(400).json({ error: 'Failed to fetch data from WestManga' });
      }
      return;
    }
    
    let syncedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    let chaptersSynced = 0;
    
    for (const mangaData of westMangaData.data) {
      processedItems++;
      const percentage = Math.round((processedItems / totalItems) * 100);
      
      if (useSSE) {
        sendSSE(res, 'progress', {
          status: 'processing',
          message: `Memproses: ${mangaData.title || mangaData.slug}`,
          processed: processedItems,
          total: totalItems,
          percentage: percentage,
          currentManga: mangaData.title || mangaData.slug
        });
      }
      try {
        let mangaId;
        
        // Check if manga already exists
        const [existing] = await db.execute(
          'SELECT id FROM manga WHERE westmanga_id = ?',
          [mangaData.id]
        );
        
        if (existing.length > 0) {
          // Update existing manga
          mangaId = existing[0].id;
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
          
          updatedCount++;
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
          
          mangaId = result.insertId;
          syncedCount++;
        }
        
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
        
        // Sync chapters
        if (mangaId) {
          try {
            // Get manga detail with chapters from /api/comic/[slug]
            const mangaDetail = await westMangaService.getMangaChapters(mangaData.slug);
            
            // Also sync genres from detail if available
            if (mangaDetail.status && mangaDetail.data && mangaDetail.data.genres) {
              const detailGenres = mangaDetail.data.genres;
              for (const genre of detailGenres) {
                const [category] = await db.execute(
                  'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)',
                  [genre.name]
                );
                
                if (category.length > 0) {
                  await db.execute(`
                    INSERT IGNORE INTO manga_genres (manga_id, category_id)
                    VALUES (?, ?)
                  `, [mangaId, category[0].id]);
                }
              }
            }
            
            if (mangaDetail.status && mangaDetail.data && mangaDetail.data.chapters) {
              const chapters = mangaDetail.data.chapters;
              
              for (const chapterData of chapters) {
                try {
                  // Check if chapter already exists
                  const [existingChapter] = await db.execute(
                    'SELECT id FROM chapters WHERE westmanga_chapter_id = ? OR (manga_id = ? AND chapter_number = ?)',
                    [chapterData.id, mangaId, chapterData.number]
                  );
                  
                  let chapterId;
                  
                  if (existingChapter.length > 0) {
                    // Update existing chapter
                    chapterId = existingChapter[0].id;
                    const transformed = westMangaService.transformChapterData(chapterData);
                    await db.execute(`
                      UPDATE chapters SET 
                        title = ?, slug = ?, chapter_number = ?, updated_at = CURRENT_TIMESTAMP
                      WHERE id = ?
                    `, [transformed.title, transformed.slug, transformed.chapter_number, chapterId]);
                  } else {
                    // Insert new chapter
                    const transformed = westMangaService.transformChapterData(chapterData);
                    const [chapterResult] = await db.execute(`
                      INSERT INTO chapters (westmanga_chapter_id, manga_id, title, slug, chapter_number, created_at)
                      VALUES (?, ?, ?, ?, ?, ?)
                    `, [
                      transformed.westmanga_chapter_id,
                      mangaId,
                      transformed.title,
                      transformed.slug,
                      transformed.chapter_number,
                      transformed.created_at
                    ]);
                    
                    chapterId = chapterResult.insertId;
                    chaptersSynced++;
                  }
                } catch (chapterError) {
                  console.error(`Error syncing chapter ${chapterData.slug}:`, chapterError.message);
                  // Continue with next chapter
                }
              }
            }
          } catch (chaptersError) {
            console.error(`Error fetching chapters for manga ${mangaData.slug}:`, chaptersError.message);
            // Continue with next manga
          }
        }
      } catch (itemError) {
        console.error(`Error syncing manga ${mangaData.slug}:`, itemError);
        errorCount++;
        
        if (useSSE) {
          sendSSE(res, 'progress', {
            status: 'error',
            message: `Error: ${mangaData.title || mangaData.slug}`,
            processed: processedItems,
            total: totalItems,
            percentage: percentage,
            error: itemError.message
          });
        }
      }
    }
    
    const finalResult = {
      message: 'Sync manga and chapters completed',
      status: 'complete',
      synced: syncedCount,
      updated: updatedCount,
      errors: errorCount,
      chaptersSynced: chaptersSynced,
      total: westMangaData.data.length,
      processed: processedItems,
      percentage: 100
    };
    
    if (useSSE) {
      // Send final progress update
      sendSSE(res, 'progress', finalResult);
      // Send complete event
      sendSSE(res, 'complete', finalResult);
      res.end();
    } else {
      res.json(finalResult);
    }
  } catch (error) {
    console.error('Error syncing manga and chapters from WestManga:', error);
    
    if (useSSE) {
      sendSSE(res, 'error', { error: 'Failed to sync manga and chapters from WestManga', details: error.message });
      res.end();
    } else {
      res.status(500).json({ error: 'Failed to sync manga and chapters from WestManga' });
    }
  }
});

// Get chapter detail (handles both manual and WestManga)
app.get('/api/chapters/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
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
    `, [slug]);
    
    if (chapters.length > 0) {
      const chapter = chapters[0];
      
      // If manual input, get images from database and format response
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
        
        // Format response to match expected structure
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
    }
    
    // If not found or from WestManga, fetch from their API
    try {
      const westChapterData = await westMangaService.getChapterDetail(slug);
      if (westChapterData.status && westChapterData.data) {
        return res.json({
          status: true,
          data: westChapterData.data
        });
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

// Get chapter images by slug (WestManga API format: /api/v/[chapter-slug])
// First checks database for manual input manga, then falls back to WestManga API
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
      
      // If manga is manual input, get images from database
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
      // If manga is not manual input, fall through to fetch from WestManga
    }
    
    // Chapter not found in database or manga is not manual input, fetch from WestManga API
    try {
      const westChapterData = await westMangaService.getChapterImages(chapterSlug);
      if (westChapterData.status && westChapterData.data) {
        return res.json(westChapterData);
      } else {
        return res.status(404).json({ 
          status: false, 
          error: 'Chapter tidak ditemukan' 
        });
      }
    } catch (westError) {
      console.error('Error fetching chapter from WestManga API:', westError);
      return res.status(404).json({ 
        status: false, 
        error: 'Chapter tidak ditemukan' 
      });
    }
  } catch (error) {
    console.error('Error fetching chapter images:', error);
    res.status(500).json({ 
      status: false, 
      error: 'Internal server error' 
    });
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
app.use((error, req, res, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 500KB' });
    }
  }
  res.status(500).json({ error: error.message });
});
