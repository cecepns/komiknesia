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
  database: 'komiknesia',
};

let db;

// Initialize database connection and start server
(async function initDatabase() {
  try {
    db = await mysql.createPool(dbConfig);
    console.log('Connected to MySQL database');

    // Ensure users table has profile_image column (migration)
    try {
      await db.execute('ALTER TABLE users ADD COLUMN profile_image VARCHAR(512) NULL DEFAULT NULL');
      console.log('Added profile_image column to users table');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.warn('Users profile_image column:', e.message);
    }
    // Ensure votes table has user_id for logged-in users
    try {
      await db.execute('ALTER TABLE votes ADD COLUMN user_id INT UNSIGNED NULL DEFAULT NULL');
      console.log('Added user_id column to votes table');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.warn('Votes user_id column:', e.message);
    }
    // Create bookmarks table if not exists
    // NOTE: Use plain INT (not UNSIGNED) so it matches existing
    // users.id and manga.id definitions, otherwise MySQL will throw
    // errno 150 "Foreign key constraint is incorrectly formed".
    await db.execute(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        manga_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_manga (user_id, manga_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (manga_id) REFERENCES manga(id) ON DELETE CASCADE
      )
    `);
    // Create comments table (manga and chapter comments, with replies)
    // Also keep INT types consistent with users/manga/chapters tables
    await db.execute(`
      CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        manga_id INT NULL,
        chapter_id INT NULL,
        parent_id INT NULL DEFAULT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (manga_id) REFERENCES manga(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
      )
    `);
    
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
let westMangaGenresCache = null;
let westMangaGenresCacheTime = null;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

// Helper function to get West Manga genres (with caching)
async function getWestMangaGenres() {
  const now = Date.now();
  // Return cached data if available and not expired
  if (westMangaGenresCache && westMangaGenresCacheTime && (now - westMangaGenresCacheTime) < CACHE_DURATION) {
    return westMangaGenresCache;
  }

  try {
    const response = await westMangaService.getGenres();
    if (response && response.data && Array.isArray(response.data)) {
      westMangaGenresCache = response.data;
      westMangaGenresCacheTime = now;
      console.log(`[Genre Cache] Loaded ${response.data.length} genres from West Manga API`);
      return westMangaGenresCache;
    } else {
      console.warn('[Genre Cache] Invalid response format from West Manga genres API');
    }
  } catch (error) {
    console.warn('Error fetching West Manga genres:', error.message);
    // Return cached data even if expired if API call fails
    if (westMangaGenresCache) {
      console.log(`[Genre Cache] Using cached genres (${westMangaGenresCache.length} genres)`);
      return westMangaGenresCache;
    }
  }
  return [];
}

// Helper function to map local genre IDs to West Manga genre IDs
async function mapLocalGenresToWestManga(localGenreIds) {
  if (!localGenreIds || localGenreIds.length === 0) {
    return [];
  }

  try {
    // Convert to integers to ensure proper type
    const genreIds = localGenreIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    if (genreIds.length === 0) {
      return [];
    }

    // Get local genre names/slugs from database
    const placeholders = genreIds.map(() => '?').join(',');
    const [localGenres] = await db.execute(
      `SELECT id, name, slug FROM categories WHERE id IN (${placeholders})`,
      genreIds
    );

    if (localGenres.length === 0) {
      console.warn(`[Genre Mapping] No local genres found for IDs: ${genreIds.join(', ')}`);
      return [];
    }

    // Get West Manga genres
    const westMangaGenres = await getWestMangaGenres();
    if (!westMangaGenres || westMangaGenres.length === 0) {
      console.warn('[Genre Mapping] No West Manga genres available for mapping');
      return [];
    }

    // Map local genres to West Manga genres by name (case-insensitive) or slug
    const mappedIds = [];
    for (const localGenre of localGenres) {
      const localName = (localGenre.name || '').toLowerCase().trim();
      const localSlug = (localGenre.slug || '').toLowerCase().trim();
      
      const matched = westMangaGenres.find(wmGenre => {
        const wmName = (wmGenre.name || '').toLowerCase().trim();
        const wmSlug = (wmGenre.slug || '').toLowerCase().trim();
        
        // Try exact match on name first, then slug
        return (localName && wmName && localName === wmName) ||
               (localSlug && wmSlug && localSlug === wmSlug);
      });

      if (matched && matched.id) {
        // Ensure ID is a number
        const westMangaId = parseInt(matched.id);
        if (!isNaN(westMangaId)) {
          mappedIds.push(westMangaId);
          console.log(`[Genre Mapping] Matched: "${localGenre.name}" (local ID: ${localGenre.id}) -> West Manga ID: ${westMangaId}`);
        } else {
          console.warn(`[Genre Mapping] Invalid West Manga ID for genre: ${localGenre.name}`);
        }
      } else {
        console.warn(`[Genre Mapping] No match found for local genre: "${localGenre.name}" (slug: "${localGenre.slug}", local ID: ${localGenre.id})`);
      }
    }

    return mappedIds;
  } catch (error) {
    console.error('[Genre Mapping] Error mapping local genres to West Manga genres:', error);
    return [];
  }
}

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
        // Keep thumbnail and is_input_manual for admin tools (e.g. MangaManager search)
        thumbnail: manga.thumbnail || coverUrl,
        is_input_manual: true,
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
    const externalPerPage = 100; // Use reasonable per_page for external API

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

    // Map local genre IDs to West Manga genre IDs
    let westMangaGenreArray = [];
    if (genreArray.length > 0) {
      westMangaGenreArray = await mapLocalGenresToWestManga(genreArray);
      // Debug logging
      if (westMangaGenreArray.length === 0) {
        console.warn(`[Genre Mapping] No matching West Manga genres found for local genre IDs: ${genreArray.join(', ')}`);
      } else {
        console.log(`[Genre Mapping] Mapped local genres ${genreArray.join(', ')} to West Manga genres ${westMangaGenreArray.join(', ')}`);
      }
    }

    try {
      // Fetch from external API - we need to fetch enough data to cover the requested page after merge
      // Strategy: fetch multiple pages from external API to ensure we have enough data
      const offset = (pageNum - 1) * perPage;
      
      // Calculate minimum items needed for the requested page
      const itemsNeeded = offset + perPage;
      
      // For 'Update' order, we merge and sort all data, so positions can change significantly
      // For other orders, local appears first, so external data starts after local
      // We need a large buffer because:
      // 1. After merge and sort, positions change (especially for 'Update' order)
      // 2. Local manga might be inserted at various positions
      // 3. Duplicates are removed, reducing total count
      // 4. We need to ensure we have enough data even if sorting changes positions
      
      // Calculate buffer more aggressively:
      // - For Update order: need more buffer because sorting can change positions drastically
      // - For other orders: local appears first, so we need buffer for external data after local
      // For higher pages, we need proportionally more buffer because:
      // 1. After merge and sort, positions can shift significantly
      // 2. Local manga might be inserted at various positions
      // 3. We need to ensure we have enough data even after deduplication
      
      // Dynamic buffer multiplier based on page number and order type
      // Higher pages need more buffer because positions change more after merge
      // For 'Update' order, we need even more buffer because all data is merged and sorted together
      const baseBufferMultiplier = orderBy === 'Update' ? 12 : 8;
      const pageBasedMultiplier = Math.max(1, Math.floor(pageNum / 2)); // Increase multiplier for higher pages
      const bufferMultiplier = baseBufferMultiplier + pageBasedMultiplier;
      
      const baseBuffer = perPage * bufferMultiplier;
      const localBuffer = localManga.length * 4; // Account for local manga taking positions
      const buffer = Math.max(baseBuffer, localBuffer + perPage * 3);
      
      const totalItemsNeeded = itemsNeeded + buffer;
      const pagesNeeded = Math.ceil(totalItemsNeeded / externalPerPage);
      
      // For higher page numbers, we need to fetch proportionally more pages
      // Calculate minimum pages needed based on page number (more aggressive for higher pages)
      // For 'Update' order, we need even more because positions change drastically after merge and sort
      const orderMultiplier = orderBy === 'Update' ? 1.5 : 1.0;
      const minPagesForOffset = Math.ceil((offset * orderMultiplier) / externalPerPage);
      const minPagesForPage = Math.ceil((pageNum * perPage * orderMultiplier) / externalPerPage);
      // Fetch at least enough to cover the page + generous buffer
      // For higher pages, add more buffer pages
      const bufferPages = Math.max(5, Math.floor(pageNum / 1.5));
      const minPagesToFetch = Math.max(minPagesForOffset, minPagesForPage) + bufferPages;
      const pagesToFetch = Math.max(minPagesToFetch, Math.min(pagesNeeded, 200)); // Increased max to 200 pages
      
      // Log for debugging
      if (pageNum >= 3) {
        console.log(`[DEBUG] Page ${pageNum}: offset=${offset}, itemsNeeded=${itemsNeeded}, buffer=${buffer}, totalItemsNeeded=${totalItemsNeeded}, pagesToFetch=${pagesToFetch}, localManga=${localManga.length}`);
      }
      
      // Fetch multiple pages in parallel
      const fetchPromises = [];
      for (let i = 1; i <= pagesToFetch; i++) {
        const externalParams = {
          page: i,
          per_page: externalPerPage,
          ...(q && { q }),
          ...(westMangaGenreArray.length > 0 && { genre: westMangaGenreArray }),
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
            ...(westMangaGenreArray.length > 0 && { genre: westMangaGenreArray }),
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
    
    // For 'Update' order, merge and sort by time regardless of local/external
    // For other orders, prioritize local manga first
    let mergedManga;
    if (orderBy === 'Update') {
      // Merge first, then sort by update time (newest first)
      mergedManga = [...localMangaList, ...externalMangaList];
      sortManga(mergedManga);
    } else {
      // For other orders, sort separately and prioritize local
      sortManga(localMangaList);
      sortManga(externalMangaList);
      mergedManga = [...localMangaList, ...externalMangaList];
    }
    
    // Remove is_local flag before sending response (keep format consistent)
    mergedManga = mergedManga.map(manga => {
      const mangaCopy = { ...manga };
      delete mangaCopy.is_local;
      return mangaCopy;
    });

    // Apply pagination after merge
    const offset = (pageNum - 1) * perPage;
    
    // Check if we have enough data after merge
    // If not, we need to fetch more data
    if (mergedManga.length < offset + perPage && externalPaginator) {
      // We don't have enough data in mergedManga to fill the requested page
      // This can happen if:
      // 1. We didn't fetch enough external data
      // 2. After merge and sort, positions changed significantly
      // 3. Many duplicates were removed
      
      console.log(`[DEBUG] Not enough data for page ${pageNum}: mergedManga.length=${mergedManga.length}, offset=${offset}, perPage=${perPage}, need=${offset + perPage}`);
      
      // Calculate how many more items we need
      const itemsShort = (offset + perPage) - mergedManga.length;
      // Add generous buffer because after merge and sort, we might need even more
      const bufferMultiplier = Math.max(3, Math.floor(pageNum / 2));
      const additionalPagesNeeded = Math.ceil((itemsShort * bufferMultiplier) / externalPerPage) + 3;
      const currentMaxPage = Math.ceil(externalManga.length / externalPerPage);
      const nextPageToFetch = currentMaxPage + 1;
      // Increase limit for additional fetches, especially for higher pages
      const maxAdditionalPages = Math.min(additionalPagesNeeded, 50); // Increased from 20 to 50
      
      console.log(`[DEBUG] Fetching additional data: itemsShort=${itemsShort}, additionalPagesNeeded=${additionalPagesNeeded}, nextPageToFetch=${nextPageToFetch}, maxAdditionalPages=${maxAdditionalPages}`);
      
      // Try to fetch more data if we're still within reasonable limits
      // Increase max page limit for higher page numbers
      const maxPageLimit = Math.max(200, pageNum * 3); // Increased limit and multiplier
      if (nextPageToFetch <= maxPageLimit && maxAdditionalPages > 0) {
        try {
          const additionalFetchPromises = [];
          for (let i = nextPageToFetch; i < nextPageToFetch + maxAdditionalPages; i++) {
            const externalParams = {
              page: i,
              per_page: externalPerPage,
              ...(q && { q }),
              ...(westMangaGenreArray.length > 0 && { genre: westMangaGenreArray }),
              ...(status && status !== 'All' && { status }),
              ...(country && { country }),
              ...(type && { type }),
              ...(orderBy && orderBy !== 'Update' && { orderBy }),
              ...(project === 'true' && { project })
            };
            additionalFetchPromises.push(westMangaService.getMangaList(externalParams));
          }
          
          const additionalResponses = await Promise.all(additionalFetchPromises);
          
          // Add additional external manga
          for (const response of additionalResponses) {
            if (response.status && response.data && Array.isArray(response.data)) {
              externalManga.push(...response.data);
            }
          }
          
          // Re-merge and re-sort with additional data
          const additionalMangaMap = new Map();
          externalManga.forEach(manga => {
            if (manga.slug) {
              additionalMangaMap.set(manga.slug, { ...manga, is_local: false });
            }
          });
          localManga.forEach(manga => {
            if (manga.slug) {
              additionalMangaMap.set(manga.slug, { ...manga, is_local: true });
            }
          });
          
          const allMangaAdditional = Array.from(additionalMangaMap.values());
          const localMangaListAdditional = allMangaAdditional.filter(m => m.is_local === true);
          const externalMangaListAdditional = allMangaAdditional.filter(m => m.is_local === false);
          
          if (orderBy === 'Update') {
            mergedManga = [...localMangaListAdditional, ...externalMangaListAdditional];
            sortManga(mergedManga);
          } else {
            sortManga(localMangaListAdditional);
            sortManga(externalMangaListAdditional);
            mergedManga = [...localMangaListAdditional, ...externalMangaListAdditional];
          }
          
          // Remove is_local flag
          mergedManga = mergedManga.map(manga => {
            const mangaCopy = { ...manga };
            delete mangaCopy.is_local;
            return mangaCopy;
          });
          
          console.log(`[DEBUG] After additional fetch: mergedManga.length=${mergedManga.length}, need=${offset + perPage}`);
          
          // If still not enough, try one more time with even more data
          if (mergedManga.length < offset + perPage && nextPageToFetch + maxAdditionalPages <= maxPageLimit) {
            const stillShort = (offset + perPage) - mergedManga.length;
            const secondAdditionalPages = Math.ceil((stillShort * 2) / externalPerPage) + 5;
            const secondNextPage = nextPageToFetch + maxAdditionalPages;
            const secondMaxPages = Math.min(secondAdditionalPages, 30);
            
            if (secondNextPage <= maxPageLimit && secondMaxPages > 0) {
              console.log(`[DEBUG] Fetching second batch: stillShort=${stillShort}, secondMaxPages=${secondMaxPages}`);
              try {
                const secondFetchPromises = [];
                for (let i = secondNextPage; i < secondNextPage + secondMaxPages; i++) {
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
                  secondFetchPromises.push(westMangaService.getMangaList(externalParams));
                }
                
                const secondResponses = await Promise.all(secondFetchPromises);
                for (const response of secondResponses) {
                  if (response.status && response.data && Array.isArray(response.data)) {
                    externalManga.push(...response.data);
                  }
                }
                
                // Re-merge again
                const finalMangaMap = new Map();
                externalManga.forEach(manga => {
                  if (manga.slug) {
                    finalMangaMap.set(manga.slug, { ...manga, is_local: false });
                  }
                });
                localManga.forEach(manga => {
                  if (manga.slug) {
                    finalMangaMap.set(manga.slug, { ...manga, is_local: true });
                  }
                });
                
                const allMangaFinal = Array.from(finalMangaMap.values());
                const localMangaListFinal = allMangaFinal.filter(m => m.is_local === true);
                const externalMangaListFinal = allMangaFinal.filter(m => m.is_local === false);
                
                if (orderBy === 'Update') {
                  mergedManga = [...localMangaListFinal, ...externalMangaListFinal];
                  sortManga(mergedManga);
                } else {
                  sortManga(localMangaListFinal);
                  sortManga(externalMangaListFinal);
                  mergedManga = [...localMangaListFinal, ...externalMangaListFinal];
                }
                
                mergedManga = mergedManga.map(manga => {
                  const mangaCopy = { ...manga };
                  delete mangaCopy.is_local;
                  return mangaCopy;
                });
                
                console.log(`[DEBUG] After second fetch: mergedManga.length=${mergedManga.length}, need=${offset + perPage}`);
              } catch (secondError) {
                console.warn('Error fetching second batch:', secondError.message);
              }
            }
          }
        } catch (additionalError) {
          console.warn('Error fetching additional data:', additionalError.message);
          // Continue with what we have
        }
      } else {
        console.log(`[DEBUG] Cannot fetch additional data: nextPageToFetch=${nextPageToFetch}, maxPageLimit=${maxPageLimit}, maxAdditionalPages=${maxAdditionalPages}`);
      }
    }
    
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

// Helper: ensure a WestManga title exists in local `manga` table by slug.
// Returns the internal manga ID or null on failure.
async function ensureWestMangaMangaIdBySlug(slug) {
  try {
    if (!slug) return null;

    // If already exists by slug, just return it
    const [existingBySlug] = await db.execute(
      'SELECT id FROM manga WHERE slug = ?',
      [slug]
    );
    if (existingBySlug.length > 0) {
      return existingBySlug[0].id;
    }

    // Fetch from WestManga API
    const mangaDetail = await westMangaService.getMangaDetail(slug);
    if (!mangaDetail || !mangaDetail.status || !mangaDetail.data) {
      console.warn(`ensureWestMangaMangaIdBySlug: No data returned from WestManga for slug "${slug}"`);
      return null;
    }

    const mangaData = mangaDetail.data;
    const transformed = westMangaService.transformMangaData(mangaData);

    // Check again by westmanga_id or transformed slug
    const [existing] = await db.execute(
      'SELECT id FROM manga WHERE westmanga_id = ? OR slug = ?',
      [mangaData.id, transformed.slug]
    );

    let mangaId;
    if (existing.length > 0) {
      mangaId = existing[0].id;
      // Update minimal fields to keep data fresh (same as sync-manga route)
      await db.execute(`
        UPDATE manga SET 
          westmanga_id = ?, title = ?, slug = ?, alternative_name = ?, author = ?,
          synopsis = ?, thumbnail = ?, content_type = ?, country_id = ?,
          color = ?, hot = ?, is_project = ?, is_safe = ?,
          rating = ?, bookmark_count = ?, views = ?, \`release\` = ?,
          status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        transformed.westmanga_id, transformed.title, transformed.slug,
        transformed.alternative_name, transformed.author, transformed.synopsis,
        transformed.thumbnail, transformed.content_type, transformed.country_id,
        transformed.color, transformed.hot, transformed.is_project,
        transformed.is_safe, transformed.rating, transformed.bookmark_count,
        transformed.views, transformed.release, transformed.status,
        mangaId
      ]);
    } else {
      // Insert new manga row
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
    }

    return mangaId || null;
  } catch (err) {
    console.error('ensureWestMangaMangaIdBySlug failed:', err);
    return null;
  }
}

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
        // Non-numeric: treat as slug. If not found locally, auto-sync from WestManga.
        const [mangaRows] = await db.execute(
          'SELECT id FROM manga WHERE slug = ?',
          [manga_id]
        );
        if (mangaRows.length > 0) {
          resolvedMangaId = mangaRows[0].id;
        } else {
          // Auto-sync from WestManga and get internal ID
          const syncedId = await ensureWestMangaMangaIdBySlug(manga_id);
          resolvedMangaId = syncedId || null;
        }
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
        await db.execute('DELETE FROM votes WHERE id = ?', [existing[0].id]);
        return res.json({ status: true, message: 'Vote removed', action: 'removed' });
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
    let { manga_id, featured_type, display_order, is_active = true, westmanga_id, slug } = req.body;
    
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
      
      // If found, use the local manga id
      if (mangaCheck.length > 0) {
        manga_id = mangaCheck[0].id;
      }
    }
    
    // If manga still not found and slug is provided, try to sync from WestManga
    if (mangaCheck.length === 0 && slug) {
      try {
        console.log(`Manga not found in database, attempting to sync from WestManga using slug: ${slug}`);
        
        // Use the existing sync-manga endpoint logic to sync the manga
        const mangaDetail = await westMangaService.getMangaDetail(slug);
        
        if (mangaDetail.status && mangaDetail.data) {
          const mangaData = mangaDetail.data;
          
          // Sync genres to categories table if needed
          if (mangaData.genres && Array.isArray(mangaData.genres)) {
            for (const genre of mangaData.genres) {
              const [existing] = await db.execute(
                'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) OR LOWER(slug) = LOWER(?)',
                [genre.name, genre.slug]
              );
              
              if (existing.length === 0) {
                await db.execute(
                  'INSERT INTO categories (name, slug) VALUES (?, ?)',
                  [genre.name, genre.slug]
                );
              }
            }
          }
          
          // Transform and insert manga
          const transformed = westMangaService.transformMangaData(mangaData);
          
          // Check if manga exists by westmanga_id or slug before inserting
          const [existingByWestmangaId] = await db.execute(
            'SELECT id FROM manga WHERE westmanga_id = ? OR slug = ?',
            [transformed.westmanga_id, transformed.slug]
          );
          
          if (existingByWestmangaId.length > 0) {
            // Manga already exists, use existing id
            manga_id = existingByWestmangaId[0].id;
            mangaCheck = existingByWestmangaId; // Update mangaCheck to indicate manga found
            console.log(`Manga already exists with id: ${manga_id}`);
          } else {
            // Insert new manga
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
            
            manga_id = result.insertId;
            mangaCheck = [{ id: manga_id }]; // Update mangaCheck to indicate manga found
            console.log(`Manga synced and inserted with id: ${manga_id}`);
            
            // Sync genres
            if (mangaData.genres && Array.isArray(mangaData.genres) && mangaData.genres.length > 0) {
              for (const genre of mangaData.genres) {
                const [category] = await db.execute(
                  'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) OR LOWER(slug) = LOWER(?)',
                  [genre.name, genre.slug]
                );
                
                if (category.length > 0) {
                  await db.execute(`
                    INSERT IGNORE INTO manga_genres (manga_id, category_id)
                    VALUES (?, ?)
                  `, [manga_id, category[0].id]);
                }
              }
            }
          }
        } else {
          return res.status(404).json({ 
            error: 'Manga not found',
            message: `Tidak dapat menemukan manga dengan slug "${slug}" di WestManga API.` 
          });
        }
      } catch (syncError) {
        console.error('Error syncing manga from WestManga:', syncError);
        return res.status(500).json({ 
          error: 'Failed to sync manga',
          message: `Gagal mensinkronkan manga dari WestManga: ${syncError.message || 'Unknown error'}` 
        });
      }
    } else if (mangaCheck.length === 0) {
      // Manga not found and no slug provided for syncing
      return res.status(404).json({ 
        error: 'Manga not found',
        message: 'Manga tidak ditemukan di database. Jika manga dari WestManga, pastikan slug dikirim untuk auto-sync.' 
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

// Sync a single manga from WestManga to database by slug
app.post('/api/westmanga/sync-manga/:slug', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const decodedSlug = decodeURIComponent(slug);
    
    // Check if manga exists in our database to get the correct WestManga slug
    const [existingManga] = await db.execute(
      'SELECT id, slug, westmanga_id, title FROM manga WHERE slug = ?',
      [decodedSlug]
    );
    
    // Use the slug from our DB if it exists (it should be the WestManga slug)
    // Otherwise use the provided slug
    const westMangaSlug = existingManga.length > 0 ? existingManga[0].slug : decodedSlug;
    
    // Use /comic/{slug} endpoint to get manga data
    // This endpoint returns full manga data (same format as search results) plus chapters
    // According to WestManga API: /api/comic/{slug} returns manga detail with chapters
    let mangaData = null;
    
    try {
      const mangaDetail = await westMangaService.getMangaDetail(westMangaSlug);
      if (mangaDetail.status && mangaDetail.data) {
        mangaData = mangaDetail.data;
        console.log(`Found manga "${mangaData.title}" from comic endpoint`);
      }
    } catch (westError) {
        const statusCode = westError.response?.status || 500;
        const errorMessage = statusCode === 404
          ? `Manga dengan slug "${westMangaSlug}" tidak ditemukan di WestManga API. Pastikan slug yang digunakan adalah slug dari WestManga.`
          : `Gagal mengambil data manga dari WestManga: ${westError.message || 'Unknown error'}`;
        
        console.error(`Error fetching manga from WestManga for slug "${westMangaSlug}":`, {
          message: westError.message,
          status: statusCode,
          response: westError.response?.data
        });
        
        return res.status(statusCode).json({ 
          error: 'Failed to fetch manga',
          message: errorMessage,
          details: {
            attemptedSlug: westMangaSlug,
            originalSlug: decodedSlug,
            statusCode: statusCode,
            suggestion: statusCode === 404 
              ? 'Pastikan slug yang digunakan adalah slug dari WestManga. Jika manga belum pernah di-sync, gunakan fitur bulk sync terlebih dahulu, atau pastikan slug sesuai dengan format WestManga.'
              : 'Periksa koneksi internet atau status API WestManga.'
          }
        });
    }
    
    if (!mangaData) {
      return res.status(404).json({ 
        error: 'Manga not found',
        message: `Data manga tidak ditemukan dari WestManga API untuk slug "${westMangaSlug}"`,
        details: {
          attemptedSlug: westMangaSlug,
          originalSlug: decodedSlug
        }
      });
    }
    
    // First, sync genres to categories table if needed
    if (mangaData.genres && Array.isArray(mangaData.genres)) {
      for (const genre of mangaData.genres) {
        const [existing] = await db.execute(
          'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) OR LOWER(slug) = LOWER(?)',
          [genre.name, genre.slug]
        );
        
        if (existing.length === 0) {
          await db.execute(
            'INSERT INTO categories (name, slug) VALUES (?, ?)',
            [genre.name, genre.slug]
          );
        }
      }
    }
    
    // Transform manga data
    const transformed = westMangaService.transformMangaData(mangaData);
    console.log('Transformed manga data:', {
      westmanga_id: transformed.westmanga_id,
      title: transformed.title,
      slug: transformed.slug,
      author: transformed.author
    });
    
    let mangaId;
    
    // Check if manga already exists
    const [existing] = await db.execute(
      'SELECT id FROM manga WHERE westmanga_id = ? OR slug = ?',
      [mangaData.id, transformed.slug]
    );
    
    if (existing.length > 0) {
      // Update existing manga
      mangaId = existing[0].id;
      console.log(`Updating existing manga with ID: ${mangaId}`);
      await db.execute(`
        UPDATE manga SET 
          westmanga_id = ?, title = ?, slug = ?, alternative_name = ?, author = ?,
          synopsis = ?, thumbnail = ?, content_type = ?, country_id = ?,
          color = ?, hot = ?, is_project = ?, is_safe = ?,
          rating = ?, bookmark_count = ?, views = ?, \`release\` = ?,
          status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        transformed.westmanga_id, transformed.title, transformed.slug,
        transformed.alternative_name, transformed.author, transformed.synopsis,
        transformed.thumbnail, transformed.content_type, transformed.country_id,
        transformed.color, transformed.hot, transformed.is_project,
        transformed.is_safe, transformed.rating, transformed.bookmark_count,
        transformed.views, transformed.release, transformed.status,
        mangaId
      ]);
      console.log(`Manga updated successfully: ${transformed.title} (ID: ${mangaId})`);
    } else {
      // Insert new manga
      console.log(`Inserting new manga: ${transformed.title}`);
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
      console.log(`Manga inserted successfully: ${transformed.title} (ID: ${mangaId}, westmanga_id: ${transformed.westmanga_id})`);
    }
    
    // Sync genres
    if (mangaData.genres && Array.isArray(mangaData.genres) && mangaData.genres.length > 0) {
      console.log(`Syncing ${mangaData.genres.length} genres for manga ${mangaId}`);
      // Clear existing genres first
      await db.execute('DELETE FROM manga_genres WHERE manga_id = ?', [mangaId]);
      
      let genresSynced = 0;
      for (const genre of mangaData.genres) {
        const [category] = await db.execute(
          'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) OR LOWER(slug) = LOWER(?)',
          [genre.name, genre.slug]
        );
        
        if (category.length > 0) {
          await db.execute(`
            INSERT IGNORE INTO manga_genres (manga_id, category_id)
            VALUES (?, ?)
          `, [mangaId, category[0].id]);
          genresSynced++;
        }
      }
      console.log(`Synced ${genresSynced} genres for manga ${mangaId}`);
    } else {
      console.log(`No genres to sync for manga ${mangaId} (genres: ${mangaData.genres ? 'empty array' : 'not provided'})`);
    }
    
    res.json({
      status: true,
      message: 'Manga berhasil diimport',
      data: {
        id: mangaId,
        slug: transformed.slug,
        title: transformed.title
      }
    });
  } catch (error) {
    console.error('Error syncing manga by slug:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
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
            // Return path as-is for uploads/ or is_input_manual (no URL conversion)
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

// Search manga (combines local and WestManga results with pagination)
// Similar to /api/contents but returns separate local and westmanga arrays
// NOTE: local results are now transformed using fetchLocalManga so the shape
// matches /api/contents (includes genres, lastChapters, rating, total_views, etc.)
app.get('/api/manga/search', async (req, res) => {
  try {
    const { query, source = 'all', page = 1, per_page = 40 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const pageNum = parseInt(page);
    const perPage = parseInt(per_page);

    let localResults = [];
    let westMangaResults = [];
    let externalPaginator = null;

    // Search local database using the same transformer as /api/contents
    if (source === 'all' || source === 'local') {
      try {
        // Use fetchLocalManga so the result format matches /api/contents
        // We only pass the search query; other filters are left empty
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
    }

    // Search WestManga API - fetch multiple pages like /api/contents does
    if (source === 'all' || source === 'westmanga') {
      try {
        // Fetch multiple pages from WestManga to get comprehensive results
        // Similar to how /api/contents fetches data
        const externalPerPage = 100;
        const pagesNeeded = Math.ceil((pageNum * perPage + localResults.length + (perPage * 2)) / externalPerPage);
        const pagesToFetch = Math.min(pagesNeeded, 20); // Fetch up to 20 pages (2000 items max)
        
        const fetchPromises = [];
        for (let i = 1; i <= pagesToFetch; i++) {
          fetchPromises.push(
            westMangaService.getMangaList({
              search: query,
              page: i,
              per_page: externalPerPage
            })
          );
        }
        
        const externalResponses = await Promise.all(fetchPromises);
        
        // Combine all results from multiple pages
        for (const response of externalResponses) {
          if (response.status && response.data && Array.isArray(response.data)) {
            westMangaResults.push(...response.data);
            // Save paginator from first response for total calculation
            if (!externalPaginator && response.paginator) {
              externalPaginator = response.paginator;
            }
          }
        }
        
        // Get accurate total by making a separate minimal request with default per_page
        if (!externalPaginator || externalPaginator.total === undefined) {
          try {
            const totalResponse = await westMangaService.getMangaList({
              search: query,
              page: 1,
              per_page: 25
            });
            if (totalResponse.paginator) {
              externalPaginator = totalResponse.paginator;
            }
          } catch (totalError) {
            console.warn('Error fetching total from external API:', totalError.message);
          }
        }
        
        // Remove duplicates by slug (in case API returns duplicates)
        const uniqueMap = new Map();
        westMangaResults.forEach(manga => {
          if (manga.slug && !uniqueMap.has(manga.slug)) {
            uniqueMap.set(manga.slug, manga);
          }
        });
        westMangaResults = Array.from(uniqueMap.values());
      } catch (westError) {
        console.warn('WestManga search failed:', westError.message);
      }
    }

    // Create a Set of local slugs for quick lookup
    const localSlugs = new Set(localResults.map(m => m.slug).filter(Boolean));

    // Merge results - avoid duplicates by slug (prefer local if duplicate)
    const mangaMap = new Map();
    
    // First add external manga (mark as not local)
    westMangaResults.forEach(manga => {
      if (manga.slug && !localSlugs.has(manga.slug)) {
        mangaMap.set(manga.slug, { ...manga, _is_local: false });
      }
    });

    // Then add local manga (will overwrite external if duplicate slug, mark as local)
    localResults.forEach(manga => {
      if (manga.slug) {
        mangaMap.set(manga.slug, { ...manga, _is_local: true });
      }
    });

    // Convert to array
    let mergedManga = Array.from(mangaMap.values());
    
    // Sort by update time (newest first) - similar to /api/contents default
    mergedManga.sort((a, b) => {
      const aTime = a.lastChapters?.[0]?.created_at?.time || 0;
      const bTime = b.lastChapters?.[0]?.created_at?.time || 0;
      return bTime - aTime;
    });

    // Apply pagination after merge
    const offset = (pageNum - 1) * perPage;
    const paginatedManga = mergedManga.slice(offset, offset + perPage);

    // Separate paginated results back into local and westmanga
    const paginatedLocal = [];
    const paginatedWestmanga = [];
    
    paginatedManga.forEach(manga => {
      const mangaCopy = { ...manga };
      const isLocal = mangaCopy._is_local === true;
      delete mangaCopy._is_local; // Remove internal flag
      
      if (isLocal) {
        paginatedLocal.push(mangaCopy);
      } else {
        paginatedWestmanga.push(mangaCopy);
      }
    });

    // Calculate total: external total + local total (local takes priority if duplicate)
    let total = 0;
    let lastPage = 1;
    
    if (externalPaginator && externalPaginator.total !== undefined) {
      // Use total from external API as base
      total = externalPaginator.total;
      
      // Add local manga count (local takes priority if duplicate)
      total += localResults.length;
      
      // Calculate last_page based on total and our per_page
      lastPage = Math.ceil(total / perPage);
    } else {
      // Fallback: use merged count if external paginator not available
      total = mergedManga.length;
      lastPage = Math.ceil(total / perPage);
    }

    res.json({
      local: paginatedLocal,
      westmanga: paginatedWestmanga,
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
