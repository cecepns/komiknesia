const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');


const app = express();
const PORT = 8080;
const JWT_SECRET = 'komiknesia-secret-key-change-in-production';

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
  user: 'komw6486_komiknesia',
  password: 'komw6486_komiknesia',
  database: 'komw6486_komiknesia',
  
  waitForConnections: true,
  connectionLimit: 10,   // maksimal 30 koneksi
  queueLimit: 0          // 0 = unlimited queue
};

let db = mysql.createPool(dbConfig);

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


const axios = require('axios');

const IMAGE_PROXY_ALLOWED_HOSTS = [
  'cd1.softkomik.online',
  'cover.softdevices.my.id',
];


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

// Auth Middleware (required - returns 401/403 if no valid token)
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ status: false, error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user still exists (include profile_image for frontend)
    const [users] = await db.execute('SELECT id, username, email, profile_image FROM users WHERE id = ?', [decoded.userId]);
    if (users.length === 0) {
      return res.status(401).json({ status: false, error: 'User not found' });
    }

    req.user = users[0];
    next();
  } catch (error) {
    return res.status(403).json({ status: false, error: 'Invalid or expired token' });
  }
};

// Optional Auth Middleware (sets req.user if valid token, does not reject)
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      req.user = null;
      return next();
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const [users] = await db.execute('SELECT id, username, email, profile_image FROM users WHERE id = ?', [decoded.userId]);
    req.user = users.length > 0 ? users[0] : null;
    next();
  } catch {
    req.user = null;
    next();
  }
};

// Routes

// Auth Routes
// Register (username must be unique, optional profile image)
app.post('/api/auth/register', upload.single('profile_image'), async (req, res) => {
  try {
    const { username, password, email } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ status: false, error: 'Username dan password wajib diisi' });
    }
    const usernameTrim = String(username).trim();
    if (usernameTrim.length < 3) {
      return res.status(400).json({ status: false, error: 'Username minimal 3 karakter' });
    }
    const usernameLower = usernameTrim.toLowerCase();
    const emailTrim = email && String(email).trim() ? String(email).trim() : '';

    // Check username uniqueness
    const [existingUsername] = await db.execute(
      'SELECT id FROM users WHERE LOWER(TRIM(username)) = ?',
      [usernameLower]
    );
    if (existingUsername.length > 0) {
      return res.status(400).json({ status: false, error: 'Username sudah dipakai. Gunakan username lain.' });
    }

    // Check email uniqueness if provided
    if (emailTrim) {
      const [existingEmail] = await db.execute(
        'SELECT id FROM users WHERE email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(?))',
        [emailTrim]
      );
      if (existingEmail.length > 0) {
        return res.status(400).json({ status: false, error: 'Email sudah dipakai. Gunakan email lain.' });
      }
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const profileImage = req.file ? `/uploads/${req.file.filename}` : null;
    const emailVal = emailTrim || null;
    await db.execute(
      'INSERT INTO users (username, password, email, profile_image) VALUES (?, ?, ?, ?)',
      [usernameLower, hashedPassword, emailVal, profileImage]
    );
    const [inserted] = await db.execute(
      'SELECT id, username, email, profile_image FROM users WHERE id = LAST_INSERT_ID()'
    );
    const user = inserted[0];
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
          email: user.email || null,
          profile_image: user.profile_image || null
        }
      }
    });
  } catch (error) {
    console.error('Error during register:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ status: false, error: 'Username and password are required' });
    }

    // Find user by username or email (include profile_image)
    const [users] = await db.execute(
      'SELECT id, username, email, password, profile_image FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({ status: false, error: 'Invalid username or password' });
    }

    const user = users[0];

    // Verify password
    const isPasswordValid = user.password.startsWith('$2')
      ? await bcrypt.compare(password, user.password)
      : password === user.password;

    if (!isPasswordValid) {
      return res.status(401).json({ status: false, error: 'Invalid username or password' });
    }

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
          email: user.email,
          profile_image: user.profile_image || null
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
        email: req.user.email,
        profile_image: req.user.profile_image || null
      }
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
});

// Update profile (optional: profile image)
app.put('/api/auth/profile', authenticateToken, upload.single('profile_image'), async (req, res) => {
  try {
    const userId = req.user.id;
    const profileImage = req.file ? `/uploads/${req.file.filename}` : null;
    const {
      username,
      email,
      current_password,
      new_password,
    } = req.body || {};

    // Load current user (including password hash)
    const [users] = await db.execute(
      'SELECT id, username, email, password, profile_image FROM users WHERE id = ?',
      [userId]
    );
    if (users.length === 0) {
      return res.status(404).json({ status: false, error: 'User not found' });
    }
    const currentUser = users[0];

    const updates = [];
    const params = [];

    // Handle username/email changes
    const usernameTrim = typeof username === 'string' ? username.trim() : '';
    const emailTrim = typeof email === 'string' ? email.trim() : '';

    if (usernameTrim && usernameTrim.toLowerCase() !== String(currentUser.username || '').trim().toLowerCase()) {
      if (usernameTrim.length < 3) {
        return res.status(400).json({ status: false, error: 'Username minimal 3 karakter' });
      }
      // Check uniqueness (exclude current user)
      const [existing] = await db.execute(
        'SELECT id FROM users WHERE id != ? AND (LOWER(TRIM(username)) = LOWER(TRIM(?)) OR (email IS NOT NULL AND TRIM(?) != "" AND LOWER(TRIM(email)) = LOWER(TRIM(?))))',
        [userId, usernameTrim, emailTrim || '', emailTrim || '']
      );
      if (existing.length > 0) {
        return res.status(400).json({ status: false, error: 'Username atau email sudah dipakai pengguna lain.' });
      }
      updates.push('username = ?');
      params.push(usernameTrim);
    }

    if (emailTrim || (email === '')) {
      // Allow clearing email by sending empty string
      const emailVal = emailTrim || null;
      if (emailVal && emailVal !== currentUser.email) {
        // Check email uniqueness (exclude current user)
        const [existingEmail] = await db.execute(
          'SELECT id FROM users WHERE id != ? AND email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(?))',
          [userId, emailVal]
        );
        if (existingEmail.length > 0) {
          return res.status(400).json({ status: false, error: 'Email sudah dipakai pengguna lain.' });
        }
      }
      updates.push('email = ?');
      params.push(emailTrim || null);
    }

    // Handle password change
    if (current_password || new_password) {
      if (!current_password || !new_password) {
        return res.status(400).json({ status: false, error: 'Password lama dan password baru wajib diisi' });
      }
      if (String(new_password).length < 6) {
        return res.status(400).json({ status: false, error: 'Password baru minimal 6 karakter' });
      }

      const isMatch = await bcrypt.compare(String(current_password), currentUser.password);
      if (!isMatch) {
        return res.status(400).json({ status: false, error: 'Password lama tidak sesuai' });
      }

      const newHashedPassword = await bcrypt.hash(String(new_password), 10);
      updates.push('password = ?');
      params.push(newHashedPassword);
    }

    // Handle profile image update
    if (profileImage) {
      updates.push('profile_image = ?');
      params.push(profileImage);
    }

    if (updates.length > 0) {
      const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
      params.push(userId);
      await db.execute(sql, params);
    }

    const [updatedUsers] = await db.execute(
      'SELECT id, username, email, profile_image FROM users WHERE id = ?',
      [userId]
    );
    const updated = updatedUsers[0];

    res.json({
      status: true,
      data: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        profile_image: updated.profile_image || null
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
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

// Cache for West Manga genres to avoid repeated API calls
// Helper function to fetch local manga (is_input_manual = true) with filters
// Optimized to avoid N+1 queries by batching genre and last-chapter lookups.
async function fetchLocalManga(filters) {
  const {
    q,
    genreArray,
    status,
    country,
    type,
    orderBy = 'Update',
    project
  } = filters || {};

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

  // Process genre IDs (safe handling)
  const genreIds = Array.isArray(genreArray)
    ? genreArray.map(g => parseInt(g, 10)).filter(g => !Number.isNaN(g))
    : [];

  // Build base query
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

  if (!mangaRows || mangaRows.length === 0) {
    return [];
  }

  const mangaIds = mangaRows.map(m => m.id);

  // Batch load genres for all manga
  let genresByMangaId = {};
  try {
    const genrePlaceholders = mangaIds.map(() => '?').join(',');
    const [genreRows] = await db.execute(
      `
        SELECT mg.manga_id, c.id, c.name, c.slug
        FROM manga_genres mg
        JOIN categories c ON mg.category_id = c.id
        WHERE mg.manga_id IN (${genrePlaceholders})
      `,
      mangaIds
    );

    genresByMangaId = genreRows.reduce((acc, row) => {
      if (!acc[row.manga_id]) acc[row.manga_id] = [];
      acc[row.manga_id].push({
        id: row.id,
        name: row.name,
        slug: row.slug
      });
      return acc;
    }, {});
  } catch (err) {
    console.error('Error loading genres for local manga:', err);
    genresByMangaId = {};
  }

  // Batch load last chapter (most recent) for all manga
  let lastChapterByMangaId = {};
  try {
    const chapterPlaceholders = mangaIds.map(() => '?').join(',');
    const [lastChapterRows] = await db.execute(
      `
        SELECT
          t.manga_id,
          c.chapter_number AS number,
          c.title,
          c.slug,
          c.created_at,
          UNIX_TIMESTAMP(c.created_at) AS created_at_timestamp
        FROM (
          SELECT
            manga_id,
            MAX(CAST(chapter_number AS UNSIGNED)) AS max_chapter_number
          FROM chapters
          WHERE manga_id IN (${chapterPlaceholders})
          GROUP BY manga_id
        ) t
        JOIN chapters c
          ON c.manga_id = t.manga_id
         AND CAST(c.chapter_number AS UNSIGNED) = t.max_chapter_number
      `,
      mangaIds
    );

    lastChapterByMangaId = lastChapterRows.reduce((acc, row) => {
      acc[row.manga_id] = {
        number: row.number,
        title: row.title,
        slug: row.slug,
        created_at: {
          time: parseInt(row.created_at_timestamp, 10)
        }
      };
      return acc;
    }, {});
  } catch (err) {
    console.error('Error loading last chapters for local manga:', err);
    lastChapterByMangaId = {};
  }

  // Transform to match WestManga API format
  const mangaList = mangaRows.map((manga) => {
    const coverUrl = manga.thumbnail || null;
    const genres = genresByMangaId[manga.id] || [];
    const lastChapter = lastChapterByMangaId[manga.id];

    return {
      id: manga.id,
      title: manga.title,
      slug: manga.slug,
      alternative_name: manga.alternative_name || null,
      author: manga.author || 'Unknown',
      sinopsis: manga.synopsis || null,
      cover: coverUrl,
      // Keep thumbnail and is_input_manual for admin tools (e.g. MangaManager search)
      thumbnail: manga.thumbnail || coverUrl,
      is_input_manual: true,
      content_type: manga.content_type || 'comic',
      country_id: manga.country_id || null,
      color: !!manga.color,
      hot: !!manga.hot,
      is_project: !!manga.is_project,
      is_safe: manga.is_safe !== null && manga.is_safe !== undefined ? !!manga.is_safe : true,
      rating: parseFloat(manga.rating) || 0,
      bookmark_count: manga.bookmark_count || 0,
      total_views: manga.views || 0,
      release: manga.release || null,
      status: manga.status || 'ongoing',
      genres,
      lastChapters: lastChapter ? [lastChapter] : []
    };
  });

  return mangaList;
}

// Get manga list with filters - merges external API with local manga (is_input_manual = true)
app.get('/api/contents', async (req, res) => {
  try {
    // Toggle ini untuk mengaktifkan / menonaktifkan fetch ke WestManga.
    // Saat false, endpoint hanya memakai data lokal dari database sendiri.
    const ENABLE_EXTERNAL_WESTMANGA = false;
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

    // Clamp page & per_page to prevent extreme values
    const rawPageNum = parseInt(page, 10) || 1;
    const rawPerPage = parseInt(per_page, 10) || 40;
    const pageNum = Math.min(Math.max(rawPageNum, 1), 200); // 1..200
    const perPage = Math.min(Math.max(rawPerPage, 10), 60); // 10..60

    // Simple in-memory cache for the most common home listing:
    // page=1, small per_page, orderBy=Update, tanpa search/genre/status/country/type/project.
    // Ini membantu banget untuk traffic tinggi di halaman utama.
    if (!global.__CONTENTS_CACHE__) {
      global.__CONTENTS_CACHE__ = { data: null, key: null, expiresAt: 0 };
    }
    const contentsCache = global.__CONTENTS_CACHE__;
    const isHomeLikeRequest =
      !q &&
      (!genreArray || genreArray.length === 0) &&
      (!status || status === 'All') &&
      !country &&
      !type &&
      (!project || project === 'false') &&
      orderBy === 'Update' &&
      pageNum === 1 &&
      perPage <= 40;

    if (isHomeLikeRequest) {
      const cacheKey = `home:update:p${pageNum}:pp${perPage}`;
      const now = Date.now();
      if (contentsCache.key === cacheKey && contentsCache.expiresAt > now) {
        return res.json(contentsCache.data);
      }
      contentsCache._currentKey = cacheKey; // simpan untuk dipakai setelah hasil jadi
    }

    // Fetch local manga
    let localManga = [];
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

    // Hanya gunakan manga lokal; WestManga sudah tidak lagi digunakan.
    const localMangaList = [...localManga];

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
    
    // Sort lokal sesuai orderBy
    sortManga(localMangaList);
    const mergedManga = localMangaList;

    // Apply pagination after merge
    const offset = (pageNum - 1) * perPage;
    
    const paginatedManga = mergedManga.slice(offset, offset + perPage);

    // Hitung total dari data lokal saja
    const total = mergedManga.length;
    const lastPage = Math.ceil(total / perPage) || 1;

    // Build paginator object
    const paginator = {
      current_page: pageNum,
      last_page: lastPage,
      per_page: perPage,
      total: total,
      from: total > 0 ? offset + 1 : 0,
      to: Math.min(offset + perPage, total)
    };

    const responsePayload = {
      status: true,
      data: paginatedManga,
      paginator: paginator
    };

    // Simpan ke cache khusus home kalau memenuhi kriteria
    if (isHomeLikeRequest && contentsCache._currentKey) {
      contentsCache.key = contentsCache._currentKey;
      contentsCache.data = responsePayload;
      contentsCache.expiresAt = Date.now() + 30 * 1000; // cache 30 detik
      delete contentsCache._currentKey;
    }

    res.json(responsePayload);
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

    // Toggle untuk mematikan/menyalakan fallback ke WestManga.
    // Saat false, endpoint hanya pakai data lokal (is_input_manual = true).
    const ENABLE_EXTERNAL_WESTMANGA_DETAIL = false;
    
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
            c.updated_at,
            UNIX_TIMESTAMP(c.created_at) as created_at_timestamp,
            UNIX_TIMESTAMP(COALESCE(c.updated_at, c.created_at)) as updated_at_timestamp
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
          chapters: chapters.map(ch => {
            const updateTime = ch.updated_at || ch.created_at;
            return {
              id: ch.id,
              content_id: ch.content_id || ch.id,
              number: ch.number,
              title: ch.title || `Chapter ${ch.number}`,
              slug: ch.slug,
              created_at: {
                time: parseInt(ch.created_at_timestamp),
                formatted: new Date(ch.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
              },
              updated_at: {
                time: parseInt(ch.updated_at_timestamp),
                formatted: new Date(updateTime).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
              }
            };
          })
        };
        
        return res.json({
          status: true,
          data: mangaData
        });
      }
      // If manga exists but is_input_manual = false, fall through to optional WestManga fetch below
    }
    
    // Manga tidak ditemukan di DB lokal atau bukan input manual
    return res.status(404).json({ 
      status: false, 
      error: 'Manga tidak ditemukan' 
    });
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
    
    // Untuk semua manga lokal, ambil chapters dari database (jika ada)
    const [chapters] = await db.execute(`
      SELECT c.*, COUNT(ci.id) as image_count
      FROM chapters c
      LEFT JOIN chapter_images ci ON c.id = ci.chapter_id
      WHERE c.manga_id = ?
      GROUP BY c.id
      ORDER BY c.chapter_number DESC
    `, [manga.id]);
    manga.chapters = chapters;
    
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
      alternative_name, content_type, country_id, release, status, rating, color, source, slug: slugOverride
    } = req.body;

    // Prefer slug from payload (misalnya dari Softkomik: title_slug yang sudah termasuk -bahasa-indonesia)
    // Jika tidak ada, generate dari title seperti biasa.
    const slugSource = slugOverride && typeof slugOverride === 'string' && slugOverride.trim()
      ? slugOverride
      : title;
    const slug = generateSlug(slugSource);
    
    // Check if slug already exists
    const [existing] = await db.execute('SELECT id FROM manga WHERE slug = ?', [slug]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Manga dengan judul serupa sudah ada' });
    }
    
    let thumbnail = req.files?.thumbnail ? `/uploads/${req.files.thumbnail[0].filename}` : null;
    let cover_background = req.files?.cover_background ? `/uploads/${req.files.cover_background[0].filename}` : null;

    // Allow direct URL thumbnail/cover from JSON body when no file uploaded (e.g. bulk import)
    if (!thumbnail) {
      thumbnail = req.body.thumbnail || req.body.cover || null;
    }
    if (!cover_background) {
      cover_background = req.body.cover_background || null;
    }
    
    const [result] = await db.execute(`
      INSERT INTO manga (
        title, slug, author, synopsis, category_id, thumbnail, cover_background,
        alternative_name, content_type, country_id, \`release\`, status, rating, color, source, is_input_manual
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title, slug, author, synopsis, category_id, thumbnail, cover_background,
      alternative_name || null, content_type || 'manga', country_id || null,
      release || null, status || 'ongoing', rating ? parseFloat(rating) : null,
      color === 'true' || color === true ? true : false,
      source || null,
      true // is_input_manual = true for manual input
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

// Sync genres for a manga by ID using genre names/slugs
app.post('/api/manga/:id/genres', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { genres } = req.body;

    if (!Array.isArray(genres) || genres.length === 0) {
      return res.status(400).json({ error: 'Genres array is required' });
    }

    // Ensure manga exists
    const [mangaRows] = await db.execute('SELECT id FROM manga WHERE id = ?', [id]);
    if (mangaRows.length === 0) {
      return res.status(404).json({ error: 'Manga not found' });
    }

    // Clear existing genres first to avoid duplicates
    await db.execute('DELETE FROM manga_genres WHERE manga_id = ?', [id]);

    let inserted = 0;
    let mainCategoryId = null;

    for (const genre of genres) {
      if (!genre) continue;

      let name = '';
      let slug = '';

      if (typeof genre === 'string') {
        name = genre;
        slug = genre
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      } else if (typeof genre === 'object' && genre !== null) {
        name = genre.name || genre.slug || '';
        slug = genre.slug || '';
      }

      if (!name && !slug) continue;

      const [category] = await db.execute(
        'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) OR LOWER(slug) = LOWER(?)',
        [name, slug || name]
      );

      if (category.length > 0) {
        const categoryId = category[0].id;
        await db.execute(
          'INSERT IGNORE INTO manga_genres (manga_id, category_id) VALUES (?, ?)',
          [id, categoryId]
        );
        if (!mainCategoryId) {
          mainCategoryId = categoryId;
        }
        inserted++;
      }
    }

    // If we found at least one genre and manga has no primary category yet, set it
    if (mainCategoryId) {
      await db.execute(
        'UPDATE manga SET category_id = ? WHERE id = ? AND (category_id IS NULL OR category_id = 0)',
        [mainCategoryId, id]
      );
    }

    res.json({
      status: true,
      message: 'Genres synced successfully',
      manga_id: Number(id),
      genres_count: inserted,
    });
  } catch (error) {
    console.error('Error syncing manga genres:', error);
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
      alternative_name, content_type, country_id, release, status, rating, color, source
    } = req.body;
    const slug = generateSlug(title);
    
    // Check if slug already exists for other manga
    const [existing] = await db.execute('SELECT id FROM manga WHERE slug = ? AND id != ?', [slug, id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Manga dengan judul serupa sudah ada' });
    }
    
    let query = `UPDATE manga SET 
      title = ?, slug = ?, author = ?, synopsis = ?, category_id = ?,
      alternative_name = ?, content_type = ?, country_id = ?, \`release\` = ?, status = ?, rating = ?, color = ?, source = ?`;
    let params = [
      title, slug, author, synopsis, category_id,
      alternative_name || null, content_type || 'manga', country_id || null,
      release || null, status || 'ongoing', rating ? parseFloat(rating) : null,
      color === 'true' || color === true ? true : false,
      source || null
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

// Bookmarks (user must be logged in)
app.get('/api/bookmarks', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 24 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(limit, 10) || 24)); // max 100 per page
    const offset = (pageNum - 1) * pageSize;

    const [[countRow]] = await db.execute(
      `SELECT COUNT(*) as total
       FROM bookmarks
       WHERE user_id = ?`,
      [userId]
    );
    const total = countRow ? countRow.total : 0;

    const [rows] = await db.execute(
      `SELECT b.id, b.manga_id, b.created_at, m.slug, m.title, m.thumbnail as cover
       FROM bookmarks b
       JOIN manga m ON m.id = b.manga_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, pageSize, offset]
    );
    res.json({
      status: true,
      data: rows,
      meta: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
});

app.post('/api/bookmarks', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    let { manga_id, slug } = req.body;
    if (!manga_id && slug) {
      const [m] = await db.execute('SELECT id FROM manga WHERE slug = ?', [slug]);
      if (m.length > 0) manga_id = m[0].id;
    }
    if (!manga_id) {
      return res.status(400).json({ status: false, error: 'manga_id or slug required' });
    }
    await db.execute(
      'INSERT IGNORE INTO bookmarks (user_id, manga_id) VALUES (?, ?)',
      [userId, manga_id]
    );
    res.json({ status: true, message: 'Bookmark added' });
  } catch (error) {
    console.error('Error adding bookmark:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
});

app.delete('/api/bookmarks/:mangaId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    let mangaId = req.params.mangaId;
    if (Number.isNaN(Number(mangaId))) {
      const [m] = await db.execute('SELECT id FROM manga WHERE slug = ?', [mangaId]);
      if (m.length > 0) mangaId = m[0].id;
    }
    await db.execute('DELETE FROM bookmarks WHERE user_id = ? AND manga_id = ?', [userId, mangaId]);
    res.json({ status: true, message: 'Bookmark removed' });
  } catch (error) {
    console.error('Error removing bookmark:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
});

app.get('/api/bookmarks/check/:mangaId', authenticateToken, async (req, res) => {
  try {
    let mangaId = req.params.mangaId;
    if (Number.isNaN(Number(mangaId))) {
      const [m] = await db.execute('SELECT id FROM manga WHERE slug = ?', [mangaId]);
      mangaId = m.length > 0 ? m[0].id : null;
    }
    if (!mangaId) {
      return res.json({ status: true, bookmarked: false });
    }
    const [rows] = await db.execute(
      'SELECT id FROM bookmarks WHERE user_id = ? AND manga_id = ?',
      [req.user.id, mangaId]
    );
    res.json({ status: true, bookmarked: rows.length > 0 });
  } catch (error) {
    console.error('Error checking bookmark:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
});

// Comments (manga or chapter; replies via parent_id; list public, add/reply require auth)
app.get('/api/comments', async (req, res) => {
  try {
    const { manga_id, chapter_id, external_slug, scope, page = 1, limit = 30 } = req.query;
    if (!manga_id && !chapter_id && !external_slug) {
      return res.status(400).json({ status: false, error: 'manga_id, chapter_id or external_slug required' });
    }
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(limit, 10) || 30)); // max 100 per page
    const offset = (pageNum - 1) * pageSize;
    let baseWhere = 'WHERE c.parent_id IS NULL';

    let query = `
      SELECT c.id, c.user_id, c.manga_id, c.chapter_id, c.parent_id, c.body, c.created_at,
             u.username, u.profile_image
      FROM comments c
      JOIN users u ON u.id = c.user_id
      ${baseWhere}
    `;
    let countQuery = `
      SELECT COUNT(*) as total
      FROM comments c
      ${baseWhere}
    `;
    const params = [];
    const countParams = [];

    // Support both numeric manga_id and slug (string) for WestManga / external sources.
    if (manga_id) {
      let resolvedMangaId = null;

      if (!isNaN(Number(manga_id))) {
        // Numeric ID – use directly
        resolvedMangaId = Number(manga_id);
      } else {
        // Non‑numeric: treat as slug and resolve to internal manga.id if it exists
        const [mangaRows] = await db.execute(
          'SELECT id FROM manga WHERE slug = ?',
          [manga_id]
        );

        if (mangaRows.length === 0) {
          // If slug not found in local DB, there is no internal manga_id to join on.
          // In this case, return empty comments list instead of querying.
          return res.json({ status: true, data: [] });
        }

        resolvedMangaId = mangaRows[0].id;
      }

      query += ' AND c.manga_id = ?';
      countQuery += ' AND c.manga_id = ?';
      params.push(resolvedMangaId);
      countParams.push(resolvedMangaId);
    }
    if (chapter_id) {
      query += ' AND c.chapter_id = ?';
      countQuery += ' AND c.chapter_id = ?';
      params.push(chapter_id);
      countParams.push(chapter_id);
    }
    if (external_slug) {
      query += ' AND c.external_slug = ?';
      countQuery += ' AND c.external_slug = ?';
      params.push(external_slug);
      countParams.push(external_slug);
    } else if (manga_id && scope === 'manga') {
      // On manga detail page, hide chapter-specific comments (those with external_slug set)
      query += ' AND c.external_slug IS NULL';
      countQuery += ' AND c.external_slug IS NULL';
    }
    query += ' ORDER BY c.created_at ASC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const [[countRow]] = await db.execute(countQuery, countParams);
    const total = countRow ? countRow.total : 0;

    const [comments] = await db.execute(query, params);
    const parentIds = comments.map(c => c.id);
    let replies = [];
    if (parentIds.length > 0) {
      const placeholders = parentIds.map(() => '?').join(',');
      const [replyRows] = await db.execute(
        `SELECT c.id, c.user_id, c.parent_id, c.body, c.created_at, u.username, u.profile_image
         FROM comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.parent_id IN (${placeholders})`,
        parentIds
      );
      replies = replyRows;
    }
    const repliesByParent = {};
    replies.forEach(r => {
      if (!repliesByParent[r.parent_id]) repliesByParent[r.parent_id] = [];
      repliesByParent[r.parent_id].push(r);
    });
    const data = comments.map(c => ({
      ...c,
      replies: (repliesByParent[c.id] || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    }));
    res.json({
      status: true,
      data,
      meta: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
});

app.post('/api/comments', authenticateToken, async (req, res) => {
  try {
    const { manga_id, chapter_id, parent_id, body, external_slug } = req.body;

    // Basic validation
    if (!body || String(body).trim().length === 0) {
      return res.status(400).json({ status: false, error: 'Komentar tidak boleh kosong' });
    }
    if (!manga_id && !chapter_id) {
      return res.status(400).json({ status: false, error: 'manga_id or chapter_id required' });
    }

    // Resolve manga_id and chapter_id to valid local IDs to avoid FK errors.
    // For West Manga / external sources, chapters might not exist locally, so we:
    // - Only set chapter_id when the chapter exists in our DB
    // - Always try to resolve/sync manga by slug when provided
    let resolvedMangaId = null;
    let resolvedChapterId = null;

    // Try to resolve chapter_id to a local chapter (if it exists)
    if (chapter_id) {
      const [chapterRows] = await db.execute(
        'SELECT id, manga_id FROM chapters WHERE id = ?',
        [chapter_id]
      );

      if (chapterRows.length > 0) {
        resolvedChapterId = chapterRows[0].id;
        resolvedMangaId = chapterRows[0].manga_id || null;
      } else {
        // Chapter is not in our DB (likely WestManga-only) → don't set chapter FK
        resolvedChapterId = null;
      }
    }

    // If we still don't have a manga_id, resolve it from the payload (ID or slug)
    if (!resolvedMangaId && manga_id) {
      // Treat manga_id as either numeric ID or slug.
      if (!isNaN(Number(manga_id))) {
        const [mangaRows] = await db.execute(
          'SELECT id FROM manga WHERE id = ?',
          [Number(manga_id)]
        );
        if (mangaRows.length > 0) {
          resolvedMangaId = mangaRows[0].id;
        } else {
          // If numeric ID not found, leave as null (no FK)
          resolvedMangaId = null;
        }
      } else {
        // Non-numeric: treat as slug and resolve only from local database.
        const [mangaRows] = await db.execute(
          'SELECT id FROM manga WHERE slug = ?',
          [manga_id]
        );
        resolvedMangaId = mangaRows.length > 0 ? mangaRows[0].id : null;
      }
    }

    const [result] = await db.execute(
      'INSERT INTO comments (user_id, manga_id, external_slug, chapter_id, parent_id, body) VALUES (?, ?, ?, ?, ?, ?)',
      [
        req.user.id,
        resolvedMangaId,
        external_slug || null,
        resolvedChapterId,
        parent_id || null,
        String(body).trim()
      ]
    );

    const [rows] = await db.execute(
      `SELECT c.id, c.user_id, c.manga_id, c.chapter_id, c.parent_id, c.body, c.created_at,
              u.username, u.profile_image
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
      [result.insertId]
    );

    res.json({ status: true, data: rows[0] });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
});

// Delete a comment (only by owner); replies are removed via FK / cascade rules
app.delete('/api/comments/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const commentId = parseInt(req.params.id, 10);
    if (!commentId || Number.isNaN(commentId)) {
      return res.status(400).json({ status: false, error: 'Invalid comment id' });
    }

    // Make sure comment exists and belongs to current user
    const [rows] = await db.execute(
      'SELECT id FROM comments WHERE id = ? AND user_id = ?',
      [commentId, userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ status: false, error: 'Comment not found' });
    }

    await db.execute('DELETE FROM comments WHERE id = ?', [commentId]);
    res.json({ status: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
});

// Votes Routes (use user_id when logged in to fix cross-browser vote bug)
// Get vote counts by manga slug
app.get('/api/votes/:slug', optionalAuthenticate, async (req, res) => {
  try {
    const { slug } = req.params;
    const user_ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    
    const [mangaRows] = await db.execute(
      'SELECT id FROM manga WHERE slug = ?',
      [slug]
    );
    
    if (mangaRows.length === 0) {
      return res.status(404).json({ status: false, error: 'Manga not found' });
    }
    
    const mangaId = mangaRows[0].id;
    
    const [votes] = await db.execute(
      `SELECT vote_type, COUNT(*) as count 
       FROM votes 
       WHERE manga_id = ? 
       GROUP BY vote_type`,
      [mangaId]
    );
    
    let userVoteRow = null;
    if (req.user) {
      const [uv] = await db.execute(
        'SELECT vote_type FROM votes WHERE manga_id = ? AND user_id = ?',
        [mangaId, req.user.id]
      );
      userVoteRow = uv.length > 0 ? uv[0] : null;
    } else {
      const [uv] = await db.execute(
        'SELECT vote_type FROM votes WHERE manga_id = ? AND user_ip = ? AND (user_id IS NULL OR user_id = 0)',
        [mangaId, user_ip]
      );
      userVoteRow = uv.length > 0 ? uv[0] : null;
    }
    
    const voteCounts = {
      senang: 0,
      biasaAja: 0,
      kecewa: 0,
      marah: 0,
      sedih: 0
    };
    
    votes.forEach(vote => {
      if (Object.prototype.hasOwnProperty.call(voteCounts, vote.vote_type)) {
        voteCounts[vote.vote_type] = vote.count;
      }
    });
    
    res.json({
      status: true,
      data: voteCounts,
      userVote: userVoteRow ? userVoteRow.vote_type : null
    });
  } catch (error) {
    console.error('Error fetching votes:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
});

// Submit vote by manga slug (send Authorization when logged in so vote is per-user, not per-IP)
app.post('/api/votes', optionalAuthenticate, async (req, res) => {
  try {
    const { slug, vote_type } = req.body;
    
    if (!slug || !vote_type) {
      return res.status(400).json({ status: false, error: 'Slug and vote_type are required' });
    }
    
    const validVoteTypes = ['senang', 'biasaAja', 'kecewa', 'marah', 'sedih'];
    if (!validVoteTypes.includes(vote_type)) {
      return res.status(400).json({ status: false, error: 'Invalid vote_type' });
    }
    
    const user_ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userId = req.user ? req.user.id : null;
    
    const [mangaRows] = await db.execute(
      'SELECT id FROM manga WHERE slug = ?',
      [slug]
    );
    
    if (mangaRows.length === 0) {
      return res.status(404).json({ status: false, error: 'Manga not found' });
    }
    
    const mangaId = mangaRows[0].id;
    
    const whereClause = userId
      ? 'manga_id = ? AND user_id = ?'
      : 'manga_id = ? AND user_ip = ? AND (user_id IS NULL OR user_id = 0)';
    const whereParams = userId ? [mangaId, userId] : [mangaId, user_ip];
    
    const [existing] = await db.execute(
      `SELECT id, vote_type FROM votes WHERE ${whereClause}`,
      whereParams
    );
    
    if (existing.length > 0) {
      if (existing[0].vote_type === vote_type) {
        // Only allow toggle (remove) for logged-in users. Anonymous users may share IP
        // (NAT, mobile carrier), so deleting would remove another person's vote.
        if (userId) {
          await db.execute('DELETE FROM votes WHERE id = ?', [existing[0].id]);
          return res.json({ status: true, message: 'Vote removed', action: 'removed' });
        }
        return res.json({ status: true, message: 'Already voted', action: 'unchanged' });
      } else {
        await db.execute('UPDATE votes SET vote_type = ? WHERE id = ?', [vote_type, existing[0].id]);
        return res.json({
          status: true,
          message: 'Vote updated',
          action: 'updated',
          previous_vote: existing[0].vote_type,
          new_vote: vote_type
        });
      }
    } else {
      if (userId) {
        await db.execute(
          'INSERT INTO votes (manga_id, vote_type, user_id) VALUES (?, ?, ?)',
          [mangaId, vote_type, userId]
        );
      } else {
        await db.execute(
          'INSERT INTO votes (manga_id, vote_type, user_ip) VALUES (?, ?, ?)',
          [mangaId, vote_type, user_ip]
        );
      }
      return res.json({ status: true, message: 'Vote recorded', action: 'added' });
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

// Helper: jika image_path adalah URL dari host yang diizinkan proxy, kembalikan URL proxy; otherwise return as-is
function toProxiedImagePathIfNeeded(imagePath, req) {
  if (!imagePath || typeof imagePath !== 'string') return imagePath;
  const trimmed = imagePath.trim();
  if (!trimmed) return imagePath;

  let parsed;
  try {
    // Support path-only (relative) — treat as same origin, no proxy
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      parsed = new URL(trimmed);
    } else {
      return imagePath;
    }
  } catch {
    return imagePath;
  }

  const host = parsed.hostname.toLowerCase();
  if (!IMAGE_PROXY_ALLOWED_HOSTS.includes(host)) return imagePath;

  const base = `${req.protocol}://${req.get('host') || req.hostname}`;
  const proxyPath = `${base.replace(/\/+$/, '')}/api/image-proxy?url=${encodeURIComponent(trimmed)}`;
  return proxyPath;
}


// Chapter Images Routes
app.get('/api/chapters/:chapterId/images', async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    const [images] = await db.execute(
      'SELECT id, image_path, page_number, created_at FROM chapter_images WHERE chapter_id = ? ORDER BY page_number',
      [chapterId]
    );

    // Validasi: URL dari cd1.softkomik.online (termasuk /softkomik/img-file/...) → kembalikan lewat proxy
    const mapped = images.map((row) => ({
      ...row,
      image_path: toProxiedImagePathIfNeeded(row.image_path, req),
    }));
    
    res.json(mapped);
  } catch (error) {
    console.error('Error fetching chapter images:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function proxySoftkomikImage(imagePath, res) {
  // await ensureCookies();

  const SOFTKOMIK_IMAGE_BASE = 'https://cd1.softkomik.online/softkomik/';
  const SOFTKOMIK_BASE = 'https://softkomik.co';
  const url = `${SOFTKOMIK_IMAGE_BASE}${imagePath}`;

  // Derive referer roughly like browser: https://softkomik.co/{slug}/chapter/{chapter}
  let referer = SOFTKOMIK_BASE;
  const segments = imagePath.split('/');
  if (segments.length >= 3) {
    const slug = segments[1];
    const chapterNumber = segments[2];
    referer = `${SOFTKOMIK_BASE}/${slug}/chapter/${chapterNumber}`;
  }

  const headers = {
    accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'accept-encoding': 'gzip, deflate, br, zstd',
    'accept-language': 'id,en;q=0.9',
    'access-code': 'NYQLFxYsnOy+/zwnNWmNTUN5',
    'cache-control': 'no-cache',
    pragma: 'no-cache',
    referer,
    'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"iOS"',
    'sec-fetch-dest': 'image',
    'sec-fetch-mode': 'no-cors',
    'sec-fetch-site': 'cross-site',
    'user-agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  };

  console.log('[image-proxy] Fetching', url);

  const upstream = await axios.get(url, {
    headers,
    responseType: 'stream',
    validateStatus: () => true, // we forward status apa adanya
  });

  res.status(upstream.status);

  // Forward beberapa header penting
  const passThroughHeaders = ['content-type', 'content-length', 'cache-control', 'last-modified', 'etag'];
  for (const [key, value] of Object.entries(upstream.headers)) {
    if (passThroughHeaders.includes(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  }

  upstream.data.pipe(res);
}

// Image proxy — fetch external image (e.g. Softkomik CDN) and stream to client (avoid CORS/hotlink)
// GET /api/image-proxy?url=<encoded_full_url>
app.get('/api/image-proxy', async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  try {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).json({ error: 'Query parameter url is required' });
    }

    let targetUrl;
    try {
      targetUrl = new URL(rawUrl.trim());
    } catch {
      return res.status(400).json({ error: 'Invalid url' });
    }

    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      return res.status(400).json({ error: 'Only http(s) URLs are allowed' });
    }

    const host = targetUrl.hostname.toLowerCase();
    if (!IMAGE_PROXY_ALLOWED_HOSTS.includes(host)) {
      return res.status(403).json({
        error: 'URL host not allowed for proxy',
        allowed: IMAGE_PROXY_ALLOWED_HOSTS,
      });
    }

    // Softkomik: gunakan proxySoftkomikImage dengan access-code, referer, dll.
    if (host === 'cd1.softkomik.online') {
      const imagePath = targetUrl.pathname.replace(/^\/softkomik\/?/i, '').replace(/^\/+/, '');
      if (!imagePath) {
        return res.status(400).json({ error: 'Invalid Softkomik image path' });
      }
      return proxySoftkomikImage(imagePath, res);
    }

    const upstream = await axios.get(targetUrl.toString(), {
      responseType: 'stream',
      validateStatus: () => true,
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'user-agent': 'Komiknesia-Image-Proxy/1.0',
      },
    });

    res.status(upstream.status);

    const passThroughHeaders = ['content-type', 'content-length', 'cache-control', 'last-modified', 'etag'];
    for (const [key, value] of Object.entries(upstream.headers)) {
      if (value != null && passThroughHeaders.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }

    upstream.data.pipe(res);
  } catch (error) {
    console.error('Error in image proxy:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Allow up to 200 images per chapter upload for manual input
app.post('/api/chapters/:chapterId/images', authenticateToken, upload.array('images', 200), async (req, res) => {
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

// Bulk insert chapter images from remote URLs (e.g. Softkomik), without uploading files
app.post('/api/chapters/:chapterId/images-from-urls', authenticateToken, async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { images } = req.body || {};

    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    // Ensure chapter exists
    const [chapterRows] = await db.execute(
      'SELECT id FROM chapters WHERE id = ?',
      [chapterId]
    );

    if (chapterRows.length === 0) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    // Get current max page_number for this chapter
    const [maxPage] = await db.execute(
      'SELECT COALESCE(MAX(page_number), 0) as max_page FROM chapter_images WHERE chapter_id = ?',
      [chapterId]
    );

    const startPageNumber = maxPage[0].max_page + 1;

    let inserted = 0;
    for (let i = 0; i < images.length; i++) {
      const imageUrl = images[i];
      if (!imageUrl || typeof imageUrl !== 'string') continue;

      await db.execute(
        'INSERT INTO chapter_images (chapter_id, image_path, page_number) VALUES (?, ?, ?)',
        [chapterId, imageUrl, startPageNumber + inserted]
      );
      inserted++;
    }

    res.status(201).json({
      message: 'Images inserted successfully from URLs',
      inserted,
    });
  } catch (error) {
    console.error('Error inserting chapter images from URLs:', error);
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

// Reorder chapter images (update page_number for multiple images)
app.put('/api/chapters/:chapterId/images/reorder', authenticateToken, async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { images } = req.body; // Array of { id, page_number }
    
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Images array is required' });
    }
    
    // Validate each image has required fields
    for (const image of images) {
      if (!image.id || image.page_number === undefined || image.page_number === null) {
        return res.status(400).json({ error: 'Each image must have id and page_number' });
      }
    }
    
    // Verify all images belong to this chapter - use a safer approach
    const imageIds = images.map(img => parseInt(img.id)).filter(id => !isNaN(id));
    
    if (imageIds.length === 0) {
      return res.status(400).json({ error: 'No valid image IDs provided' });
    }
    
    // Build query with proper placeholders - ensure we have valid placeholders
    let existingImages;
    
    if (imageIds.length === 1) {
      // Single ID case
      [existingImages] = await db.execute(
        'SELECT id FROM chapter_images WHERE id = ? AND chapter_id = ?',
        [imageIds[0], parseInt(chapterId)]
      );
    } else {
      // Multiple IDs case - build query with proper placeholders
      const placeholders = imageIds.map(() => '?').join(',');
      const query = `SELECT id FROM chapter_images WHERE id IN (${placeholders}) AND chapter_id = ?`;
      const params = [...imageIds, parseInt(chapterId)];
      
      console.log('Verifying images query:', query);
      console.log('Verifying images params:', params);
      
      [existingImages] = await db.execute(query, params);
    }
    
    if (existingImages.length !== images.length) {
      return res.status(400).json({ 
        error: 'Some images do not belong to this chapter',
        expected: images.length,
        found: existingImages.length
      });
    }
    
    // Update page_number for each image
    // Note: Using individual updates instead of transaction for compatibility
    const updatePromises = [];
    
    for (const image of images) {
      const imageId = parseInt(image.id);
      const pageNumber = parseInt(image.page_number);
      
      if (isNaN(imageId) || isNaN(pageNumber)) {
        return res.status(400).json({ 
          error: 'Invalid image data',
          details: `id=${image.id}, page_number=${image.page_number}`
        });
      }
      
      updatePromises.push(
        db.execute(
          'UPDATE chapter_images SET page_number = ? WHERE id = ? AND chapter_id = ?',
          [pageNumber, imageId, parseInt(chapterId)]
        )
      );
    }
    
    // Execute all updates
    await Promise.all(updatePromises);
    
    res.json({ message: 'Images reordered successfully' });
  } catch (error) {
    console.error('Error reordering chapter images:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
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

    // Simple in-memory cache for frequently used combos (e.g. type=banner&active=true)
    if (!global.__FEATURED_CACHE__) {
      global.__FEATURED_CACHE__ = { data: null, key: null, expiresAt: 0 };
    }
    const cacheState = global.__FEATURED_CACHE__;
    const cacheKey = JSON.stringify({
      type: type || null,
      active: active === undefined ? null : active === 'true'
    });
    const now = Date.now();
    if (cacheState.key === cacheKey && cacheState.expiresAt > now) {
      return res.json(cacheState.data);
    }

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

    if (items.length === 0) {
      cacheState.key = cacheKey;
      cacheState.data = [];
      cacheState.expiresAt = now + 30 * 1000;
      return res.json([]);
    }

    // Avoid N+1 queries by batching genres and lastChapters
    const mangaIds = items.map(i => i.manga_id);
    const idPlaceholders = mangaIds.map(() => '?').join(',');

    // Batch genres
    let genresByMangaId = {};
    try {
      const [genreRows] = await db.execute(`
        SELECT mg.manga_id, c.id, c.name, c.slug
        FROM manga_genres mg
        JOIN categories c ON mg.category_id = c.id
        WHERE mg.manga_id IN (${idPlaceholders})
      `, mangaIds);

      genresByMangaId = genreRows.reduce((acc, row) => {
        if (!acc[row.manga_id]) acc[row.manga_id] = [];
        acc[row.manga_id].push({
          id: row.id,
          name: row.name,
          slug: row.slug
        });
        return acc;
      }, {});
    } catch (err) {
      console.error('Error loading genres for featured items:', err);
      genresByMangaId = {};
    }

    // Batch last chapters
    let lastChapterByMangaId = {};
    try {
      const [lastChapterRows] = await db.execute(`
        SELECT
          t.manga_id,
          c.chapter_number AS number,
          c.title,
          c.slug,
          c.created_at,
          UNIX_TIMESTAMP(c.created_at) AS created_at_timestamp
        FROM (
          SELECT
            manga_id,
            MAX(CAST(chapter_number AS UNSIGNED)) AS max_chapter_number
          FROM chapters
          WHERE manga_id IN (${idPlaceholders})
          GROUP BY manga_id
        ) t
        JOIN chapters c
          ON c.manga_id = t.manga_id
         AND CAST(c.chapter_number AS UNSIGNED) = t.max_chapter_number
      `, mangaIds);

      lastChapterByMangaId = lastChapterRows.reduce((acc, row) => {
        acc[row.manga_id] = [{
          number: row.number,
          title: row.title,
          slug: row.slug,
          created_at: {
            time: parseInt(row.created_at_timestamp, 10)
          }
        }];
        return acc;
      }, {});
    } catch (err) {
      console.error('Error loading last chapters for featured items:', err);
      lastChapterByMangaId = {};
    }

    const enriched = items.map(item => ({
      ...item,
      genres: genresByMangaId[item.manga_id] || [],
      lastChapters: lastChapterByMangaId[item.manga_id] || []
    }));

    // Cache result for a short time (30 detik) – cukup untuk banner/home.
    cacheState.key = cacheKey;
    cacheState.data = enriched;
    cacheState.expiresAt = now + 30 * 1000;

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching featured items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/featured-items', authenticateToken, async (req, res) => {
  try {
    let { manga_id, featured_type, display_order, is_active = true, westmanga_id, slug } = req.body;
    
    // Handle display_order: null or undefined becomes 0
    if (display_order === null || display_order === undefined) {
      display_order = 0;
    }
    
    if (!manga_id || !featured_type) {
      return res.status(400).json({ error: 'manga_id and featured_type are required' });
    }
    
    // Check if manga exists by id or westmanga_id/slug if provided (local DB only)
    let [mangaCheck] = await db.execute('SELECT id FROM manga WHERE id = ?', [manga_id]);
    
    if (mangaCheck.length === 0 && westmanga_id) {
      [mangaCheck] = await db.execute('SELECT id FROM manga WHERE westmanga_id = ?', [westmanga_id]);
      if (mangaCheck.length > 0) {
        manga_id = mangaCheck[0].id;
      }
    }
    
    if (mangaCheck.length === 0 && slug) {
      [mangaCheck] = await db.execute('SELECT id FROM manga WHERE slug = ?', [slug]);
      if (mangaCheck.length > 0) {
        manga_id = mangaCheck[0].id;
      }
    }
    
    if (mangaCheck.length === 0) {
      return res.status(404).json({ 
        error: 'Manga not found',
        message: 'Manga tidak ditemukan di database.' 
      });
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
    // Simple in-memory cache for ads list (often used in many pages)
    if (!global.__ADS_CACHE__) {
      global.__ADS_CACHE__ = { data: null, expiresAt: 0 };
    }
    const now = Date.now();
    if (global.__ADS_CACHE__.data && global.__ADS_CACHE__.expiresAt > now) {
      return res.json(global.__ADS_CACHE__.data);
    }

    const [ads] = await db.execute('SELECT * FROM ads ORDER BY created_at DESC LIMIT 20');

    global.__ADS_CACHE__.data = ads;
    global.__ADS_CACHE__.expiresAt = now + 60 * 1000; // cache 60 detik

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
    const { link_url, ads_type, image_alt, title } = req.body;
    
    let query = 'UPDATE ads SET link_url = ?, ads_type = ?, image_alt = ?, title = ?';
    let params = [link_url || null, ads_type || null, image_alt || null, title || null];
    
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

// Settings (popup intervals etc.)
const POPUP_INTERVAL_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

app.get('/api/settings', async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT `key`, `value` FROM settings WHERE `key` IN ('popup_ads_interval_minutes', 'home_popup_interval_minutes')");
    const map = Object.fromEntries((rows || []).map((r) => [r.key, r.value]));
    const popupAds = parseInt(map.popup_ads_interval_minutes, 10);
    const homePopup = parseInt(map.home_popup_interval_minutes, 10);
    res.json({
      popup_ads_interval_minutes: Number.isFinite(popupAds) && POPUP_INTERVAL_OPTIONS.includes(popupAds) ? popupAds : 20,
      home_popup_interval_minutes: Number.isFinite(homePopup) && POPUP_INTERVAL_OPTIONS.includes(homePopup) ? homePopup : 30,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.json({ popup_ads_interval_minutes: 20, home_popup_interval_minutes: 30 });
  }
});

app.put('/api/settings', authenticateToken, async (req, res) => {
  try {
    const { popup_ads_interval_minutes, home_popup_interval_minutes } = req.body;
    const set = (key, value) => {
      const v = parseInt(value, 10);
      if (!Number.isFinite(v) || !POPUP_INTERVAL_OPTIONS.includes(v)) return;
      return db.execute('INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?', [key, String(v), String(v)]);
    };
    if (popup_ads_interval_minutes !== undefined) await set('popup_ads_interval_minutes', popup_ads_interval_minutes);
    if (home_popup_interval_minutes !== undefined) await set('home_popup_interval_minutes', home_popup_interval_minutes);
    res.json({ message: 'Settings updated' });
  } catch (error) {
    console.error('Error updating settings:', error);
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


// Get chapter detail (hanya dari database lokal)
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
      
      // Hanya dukung chapter dari manga input manual
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
          images: images.map(img => toProxiedImagePathIfNeeded(img.image_path, req)),
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
    
    // Chapter tidak ditemukan atau bukan dari manga manual
    res.status(404).json({ error: 'Chapter not found' });
  } catch (error) {
    console.error('Error fetching chapter:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

// Search manga (combines local and WestManga results with pagination)
// Similar to /api/contents but returns separate local and westmanga arrays
// NOTE: local results are now transformed using fetchLocalManga so the shape
// matches /api/contents (includes genres, lastChapters, rating, total_views, etc.)
app.get('/api/manga/search', async (req, res) => {
  try {
    const { query, page = 1, per_page = 40 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const pageNum = parseInt(page, 10) || 1;
    const perPage = parseInt(per_page, 10) || 40;

    let localResults = [];

    try {
      // Gunakan fetchLocalManga agar format hasil sama dengan /api/contents
      localResults = await fetchLocalManga({
        q: query,
        genreArray: [],
        status: null,
        country: null,
        type: null,
        orderBy: 'Update',
        project: null
      });
    } catch (localError) {
      console.error('Error searching local manga:', localError);
    }

    // Sort by update time (newest first) - mirip default /api/contents
    localResults.sort((a, b) => {
      const aTime = a.lastChapters?.[0]?.created_at?.time || 0;
      const bTime = b.lastChapters?.[0]?.created_at?.time || 0;
      return bTime - aTime;
    });

    // Pagination
    const offset = (pageNum - 1) * perPage;
    const paginatedLocal = localResults.slice(offset, offset + perPage);
    const total = localResults.length;
    const lastPage = Math.ceil(total / perPage);

    res.json({
      local: paginatedLocal,
      westmanga: [],
      total: total,
      paginator: {
        current_page: pageNum,
        last_page: lastPage,
        per_page: perPage,
        total: total,
        from: total > 0 ? offset + 1 : 0,
        to: Math.min(offset + perPage, total)
      }
    });
  } catch (error) {
    console.error('Error searching manga:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// SITEMAP & ROBOTS.TXT GENERATION
// ==========================================

const SITE_URL = 'https://komiknesia.net';
const API_URL = 'https://api.komiknesia.net';

/**
 * Serve robots.txt for the API domain
 */
app.get('/robots.txt', (req, res) => {
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
});

/**
 * Generate XML sitemap dynamically
 * Includes static pages, all manga detail pages, and all chapter pages
 */
app.get('/sitemap.xml', async (req, res) => {
  try {
    // Static pages with their priorities and change frequencies
    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/content', priority: '0.9', changefreq: 'daily' },
      { url: '/library', priority: '0.8', changefreq: 'daily' },
      { url: '/contact', priority: '0.5', changefreq: 'monthly' },
    ];

    // Fetch all manga from database
    const [mangaRows] = await db.execute(`
      SELECT slug, updated_at 
      FROM manga 
      WHERE slug IS NOT NULL AND slug != ''
      ORDER BY updated_at DESC
    `);

    // Fetch all chapters from database
    const [chapterRows] = await db.execute(`
      SELECT c.slug, c.updated_at
      FROM chapters c
      WHERE c.slug IS NOT NULL AND c.slug != ''
      ORDER BY c.updated_at DESC
    `);

    // Get current date for lastmod
    const now = new Date().toISOString().split('T')[0];

    // Start building XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add static pages
    for (const page of staticPages) {
      xml += '  <url>\n';
      xml += `    <loc>${SITE_URL}${page.url}</loc>\n`;
      xml += `    <lastmod>${now}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    }

    // Add manga detail pages
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

    // Add chapter reader pages
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

    // Set proper content type for XML
    res.set('Content-Type', 'application/xml');
    res.send(xml);

  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

/**
 * Generate sitemap index for large sites (optional - splits sitemap into multiple files)
 * Use this if you have more than 50,000 URLs
 */
app.get('/sitemap-index.xml', async (req, res) => {
  try {
    const now = new Date().toISOString().split('T')[0];
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    // Main sitemap
    xml += '  <sitemap>\n';
    xml += `    <loc>${SITE_URL}/sitemap.xml</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += '  </sitemap>\n';
    
    // Manga sitemap
    xml += '  <sitemap>\n';
    xml += `    <loc>${SITE_URL}/sitemap-manga.xml</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += '  </sitemap>\n';
    
    // Chapters sitemap
    xml += '  <sitemap>\n';
    xml += `    <loc>${SITE_URL}/sitemap-chapters.xml</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += '  </sitemap>\n';
    
    xml += '</sitemapindex>';

    res.set('Content-Type', 'application/xml');
    res.send(xml);

  } catch (error) {
    console.error('Error generating sitemap index:', error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>');
  }
});

/**
 * Separate sitemap for manga pages only
 */
app.get('/sitemap-manga.xml', async (req, res) => {
  try {
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

  } catch (error) {
    console.error('Error generating manga sitemap:', error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

/**
 * Separate sitemap for chapter pages only
 */
app.get('/sitemap-chapters.xml', async (req, res) => {
  try {
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

  } catch (error) {
    console.error('Error generating chapters sitemap:', error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

/**
 * API endpoint to get sitemap stats (for admin dashboard)
 */
app.get('/api/sitemap/stats', async (req, res) => {
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
        total_urls: 4 + mangaCount[0].count + chapterCount[0].count
      }
    });
  } catch (error) {
    console.error('Error getting sitemap stats:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});