const db = require('../db');
const { generateSlug } = require('../utils/slug');
const { deleteFile } = require('../utils/files');
const { uploadFileToS3 } = require('../utils/s3Upload');
const { deleteUrlFromS3 } = require('../utils/s3Upload');
const fs = require('fs');
const path = require('path');

const index = async (req, res) => {
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
      query +=
        ' AND (m.category_id = ? OR m.id IN (SELECT manga_id FROM manga_genres WHERE category_id = ?))';
      params.push(category, category);
    }

    if (source === 'manual') {
      query += ' AND m.is_input_manual = TRUE';
    } else if (source === 'westmanga') {
      query += ' AND m.is_input_manual = FALSE';
    }

    query += ' GROUP BY m.id ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const [manga] = await db.execute(query, params);

    const mangaIds = manga.map((m) => m.id);

    let genresByMangaId = {};
    if (mangaIds.length > 0) {
      try {
        const placeholders = mangaIds.map(() => '?').join(',');
        const [genreRows] = await db.execute(
          `
            SELECT mg.manga_id, c.id, c.name, c.slug
            FROM manga_genres mg
            JOIN categories c ON mg.category_id = c.id
            WHERE mg.manga_id IN (${placeholders})
          `,
          mangaIds
        );

        genresByMangaId = genreRows.reduce((acc, row) => {
          if (!acc[row.manga_id]) acc[row.manga_id] = [];
          acc[row.manga_id].push({
            id: row.id,
            name: row.name,
            slug: row.slug,
          });
          return acc;
        }, {});
      } catch (err) {
        console.error('Error loading genres for manga list:', err);
        genresByMangaId = {};
      }
    }

    for (const m of manga) {
      m.genres = genresByMangaId[m.id] || [];
    }

    let countQuery = 'SELECT COUNT(DISTINCT m.id) as total FROM manga m WHERE 1=1';
    const countParams = [];

    if (search) {
      countQuery += ' AND (m.title LIKE ? OR m.alternative_name LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      countQuery +=
        ' AND (m.category_id = ? OR m.id IN (SELECT manga_id FROM manga_genres WHERE category_id = ?))';
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
      currentPage: parseInt(page, 10),
      totalCount: countResult[0].total,
    });
  } catch (error) {
    console.error('Error fetching manga:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const listChapters = async (req, res) => {
  try {
    const { mangaId } = req.params;
    const [chapters] = await db.execute(
      `
      SELECT c.*, COUNT(ci.id) as image_count
      FROM chapters c
      LEFT JOIN chapter_images ci ON c.id = ci.chapter_id
      WHERE c.manga_id = ?
      GROUP BY c.id
      ORDER BY CAST(c.chapter_number AS UNSIGNED) ASC, c.chapter_number ASC
    `,
      [mangaId]
    );

    res.json(chapters);
  } catch (error) {
    console.error('Error fetching chapters:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createChapter = async (req, res) => {
  try {
    const { mangaId } = req.params;
    const { title, chapter_number } = req.body;
    const cover = req.file ? `/uploads/${req.file.filename}` : null;

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
};

const showBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const [rows] = await db.execute(
      `
      SELECT m.*, c.name as category_name, COUNT(v.id) as votes
      FROM manga m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN votes v ON m.id = v.manga_id
      WHERE m.slug = ?
      GROUP BY m.id
    `,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Manga not found' });
    }

    const manga = rows[0];

    const [genres] = await db.execute(
      `
      SELECT c.id, c.name, c.slug
      FROM manga_genres mg
      JOIN categories c ON mg.category_id = c.id
      WHERE mg.manga_id = ?
    `,
      [manga.id]
    );

    manga.genres = genres;

    const [chapters] = await db.execute(
      `
      SELECT c.*, COUNT(ci.id) as image_count
      FROM chapters c
      LEFT JOIN chapter_images ci ON c.id = ci.chapter_id
      WHERE c.manga_id = ?
      GROUP BY c.id
      ORDER BY CAST(c.chapter_number AS UNSIGNED) DESC, c.chapter_number DESC
    `,
      [manga.id]
    );
    manga.chapters = chapters;

    res.json(manga);
  } catch (error) {
    console.error('Error fetching manga by slug:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const store = async (req, res) => {
  try {
    const {
      title,
      author,
      synopsis,
      category_id,
      genre_ids,
      alternative_name,
      content_type,
      country_id,
      release,
      status,
      rating,
      color,
      source,
      slug: slugOverride,
    } = req.body;

    const slugSource =
      slugOverride && typeof slugOverride === 'string' && slugOverride.trim()
        ? slugOverride
        : title;
    const slug = generateSlug(slugSource);

    const [existing] = await db.execute('SELECT id FROM manga WHERE slug = ?', [slug]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Manga dengan judul serupa sudah ada' });
    }

    let thumbnail = null;
    let cover_background = null;

    if (req.files?.thumbnail && req.files.thumbnail[0]) {
      const f = req.files.thumbnail[0];
      const ext = path.extname(f.originalname || f.filename || '') || '.webp';
      const key = `komiknesia/manga/${slug}/thumbnail-${Date.now()}${ext}`;
      thumbnail = await uploadFileToS3(key, f.path, f.mimetype);
      try {
        fs.unlinkSync(f.path);
      } catch {}
    }

    if (req.files?.cover_background && req.files.cover_background[0]) {
      const f = req.files.cover_background[0];
      const ext = path.extname(f.originalname || f.filename || '') || '.webp';
      const key = `komiknesia/manga/${slug}/cover-bg-${Date.now()}${ext}`;
      cover_background = await uploadFileToS3(key, f.path, f.mimetype);
      try {
        fs.unlinkSync(f.path);
      } catch {}
    }

    if (!thumbnail) {
      thumbnail = req.body.thumbnail || req.body.cover || null;
    }
    if (!cover_background) {
      cover_background = req.body.cover_background || null;
    }

    const [result] = await db.execute(
      `
      INSERT INTO manga (
        title, slug, author, synopsis, category_id, thumbnail, cover_background,
        alternative_name, content_type, country_id, \`release\`, status, rating, color, source, is_input_manual
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        title,
        slug,
        author,
        synopsis,
        category_id,
        thumbnail,
        cover_background,
        alternative_name || null,
        content_type || 'manga',
        country_id || null,
        release || null,
        status || 'ongoing',
        rating ? parseFloat(rating) : null,
        color === 'true' || color === true ? true : false,
        source || null,
        true,
      ]
    );

    const mangaId = result.insertId;

    if (genre_ids) {
      const genreArray = Array.isArray(genre_ids) ? genre_ids : JSON.parse(genre_ids);
      for (const genreId of genreArray) {
        await db.execute('INSERT INTO manga_genres (manga_id, category_id) VALUES (?, ?)', [
          mangaId,
          genreId,
        ]);
      }
    }

    res.status(201).json({ id: mangaId, message: 'Manga created successfully' });
  } catch (error) {
    console.error('Error creating manga:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      author,
      synopsis,
      category_id,
      genre_ids,
      alternative_name,
      content_type,
      country_id,
      release,
      status,
      rating,
      color,
      source,
    } = req.body;

    const slug = generateSlug(title);

    const [existing] = await db.execute('SELECT id FROM manga WHERE slug = ? AND id != ?', [
      slug,
      id,
    ]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Manga dengan judul serupa sudah ada' });
    }

    let query = `UPDATE manga SET 
      title = ?, slug = ?, author = ?, synopsis = ?, category_id = ?,
      alternative_name = ?, content_type = ?, country_id = ?, \`release\` = ?, status = ?, rating = ?, color = ?, source = ?`;
    const params = [
      title,
      slug,
      author,
      synopsis,
      category_id,
      alternative_name || null,
      content_type || 'manga',
      country_id || null,
      release || null,
      status || 'ongoing',
      rating ? parseFloat(rating) : null,
      color === 'true' || color === true ? true : false,
      source || null,
    ];

    if (req.files?.thumbnail && req.files.thumbnail[0]) {
      const f = req.files.thumbnail[0];
      const ext = path.extname(f.originalname || f.filename || '') || '.webp';
      const key = `komiknesia/manga/${slug}/thumbnail-${Date.now()}${ext}`;
      const url = await uploadFileToS3(key, f.path, f.mimetype);
      query += ', thumbnail = ?';
      params.push(url);
      try {
        fs.unlinkSync(f.path);
      } catch {}
    }

    if (req.files?.cover_background && req.files.cover_background[0]) {
      const f = req.files.cover_background[0];
      const ext = path.extname(f.originalname || f.filename || '') || '.webp';
      const key = `komiknesia/manga/${slug}/cover-bg-${Date.now()}${ext}`;
      const url = await uploadFileToS3(key, f.path, f.mimetype);
      query += ', cover_background = ?';
      params.push(url);
      try {
        fs.unlinkSync(f.path);
      } catch {}
    }

    query += ' WHERE id = ?';
    params.push(id);

    await db.execute(query, params);

    if (genre_ids) {
      await db.execute('DELETE FROM manga_genres WHERE manga_id = ?', [id]);

      const genreArray = Array.isArray(genre_ids) ? genre_ids : JSON.parse(genre_ids);
      for (const genreId of genreArray) {
        await db.execute('INSERT INTO manga_genres (manga_id, category_id) VALUES (?, ?)', [
          id,
          genreId,
        ]);
      }
    }

    res.json({ message: 'Manga updated successfully' });
  } catch (error) {
    console.error('Error updating manga:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const destroy = async (req, res) => {
  try {
    const { id } = req.params;

    const [mangaRows] = await db.execute('SELECT thumbnail, cover_background FROM manga WHERE id = ?', [
      id,
    ]);

    if (mangaRows.length === 0) {
      return res.status(404).json({ error: 'Manga not found' });
    }

    const manga = mangaRows[0];

    // Best-effort delete for both local uploads and S3 URLs
    deleteFile(manga.thumbnail);
    deleteFile(manga.cover_background);
    try {
      await deleteUrlFromS3(manga.thumbnail);
    } catch (e) {
      console.warn('Failed deleting manga thumbnail from S3:', e.message);
    }
    try {
      await deleteUrlFromS3(manga.cover_background);
    } catch (e) {
      console.warn('Failed deleting manga cover_background from S3:', e.message);
    }

    const [chapters] = await db.execute('SELECT id, cover FROM chapters WHERE manga_id = ?', [id]);

    for (const chapter of chapters) {
      deleteFile(chapter.cover);
      try {
        await deleteUrlFromS3(chapter.cover);
      } catch (e) {
        console.warn('Failed deleting chapter cover from S3:', e.message);
      }

      const [images] = await db.execute('SELECT image_path FROM chapter_images WHERE chapter_id = ?', [
        chapter.id,
      ]);

      for (const image of images) {
        deleteFile(image.image_path);
        try {
          await deleteUrlFromS3(image.image_path);
        } catch (e) {
          console.warn('Failed deleting chapter image from S3:', e.message);
        }
      }
    }

    await db.execute('DELETE FROM manga WHERE id = ?', [id]);
    res.json({ message: 'Manga deleted successfully' });
  } catch (error) {
    console.error('Error deleting manga:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const search = async (req, res) => {
  try {
    const { query, page = 1, per_page = 40 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const pageNum = parseInt(page, 10) || 1;
    const perPage = parseInt(per_page, 10) || 40;

    // NOTE: assumes fetchLocalManga has been moved to a shared util.
    const { fetchLocalManga } = require('../utils/manga'); // adjust if needed

    let localResults = [];

    try {
      localResults = await fetchLocalManga({
        q: query,
        genreArray: [],
        status: null,
        country: null,
        type: null,
        orderBy: 'Update',
        project: null,
      });
    } catch (localError) {
      console.error('Error searching local manga:', localError);
    }

    localResults.sort((a, b) => {
      const aTime = a.lastChapters?.[0]?.created_at?.time || 0;
      const bTime = b.lastChapters?.[0]?.created_at?.time || 0;
      return bTime - aTime;
    });

    const offset = (pageNum - 1) * perPage;
    const paginatedLocal = localResults.slice(offset, offset + perPage);
    const total = localResults.length;
    const lastPage = Math.ceil(total / perPage);

    res.json({
      local: paginatedLocal,
      westmanga: [],
      total,
      paginator: {
        current_page: pageNum,
        last_page: lastPage,
        per_page: perPage,
        total,
        from: total > 0 ? offset + 1 : 0,
        to: Math.min(offset + perPage, total),
      },
    });
  } catch (error) {
    console.error('Error searching manga:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  index,
  listChapters,
  createChapter,
  showBySlug,
  store,
  update,
  destroy,
  search,
};

