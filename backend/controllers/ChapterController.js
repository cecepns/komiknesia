const db = require('../db');
const { upload } = require('../middlewares/upload'); // used in routes, not here
const { deleteFile } = require('../utils/files'); // adjust path if needed
const { uploadFileToS3 } = require('../utils/s3Upload');
const { deleteUrlFromS3 } = require('../utils/s3Upload');
const fs = require('fs');
const path = require('path');

const showBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const [chapters] = await db.execute(
      `
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
    `,
      [slug]
    );

    if (chapters.length > 0) {
      const chapter = chapters[0];

      if (chapter.is_input_manual) {
        const [images] = await db.execute(
          `
          SELECT image_path
          FROM chapter_images
          WHERE chapter_id = ?
          ORDER BY page_number
        `,
          [chapter.id]
        );

        const [allChapters] = await db.execute(
          `
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
        `,
          [chapter.manga_id]
        );

        const [genres] = await db.execute(
          `
          SELECT c.id, c.name, c.slug
          FROM manga_genres mg
          JOIN categories c ON mg.category_id = c.id
          WHERE mg.manga_id = ?
        `,
          [chapter.manga_id]
        );

        const responseData = {
          images: images.map((img) => img.image_path),
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
            color: !!chapter.color,
            hot: !!chapter.hot,
            is_project: !!chapter.is_project,
            is_safe: !!chapter.is_safe,
            rating: parseFloat(chapter.rating) || 0,
            bookmark_count: chapter.bookmark_count || 0,
            total_views: chapter.total_views || 0,
            release: chapter.release || null,
            status: chapter.status || 'ongoing',
            genres,
          },
          chapters: allChapters.map((ch) => ({
            id: ch.id,
            content_id: ch.content_id || ch.id,
            number: ch.number,
            title: ch.title || `Chapter ${ch.number}`,
            slug: ch.slug,
            created_at: {
              time: parseInt(ch.created_at_timestamp, 10),
              formatted: new Date(ch.created_at).toLocaleString('id-ID'),
            },
          })),
          number: chapter.number,
        };

        // Award EXP once per user per chapter.
        if (req.user?.id) {
          const membershipActive = !!req.user.membership_active;
          const expGain = membershipActive ? 24 : 20;
          let gainedExp = 0;

          try {
            const [insertRead] = await db.execute(
              `INSERT IGNORE INTO user_chapter_reads (user_id, chapter_id, exp_awarded)
               VALUES (?, ?, ?)`,
              [req.user.id, chapter.id, expGain]
            );

            if (insertRead.affectedRows > 0) {
              await db.execute(
                'UPDATE users SET points = points + ? WHERE id = ?',
                [expGain, req.user.id]
              );
              gainedExp = expGain;
            }

            const [userRows] = await db.execute(
              `SELECT
                points,
                is_membership,
                membership_expires_at,
                CASE
                  WHEN is_membership = 1 AND (membership_expires_at IS NULL OR membership_expires_at >= NOW())
                  THEN 1
                  ELSE 0
                END AS membership_active
               FROM users
               WHERE id = ?`,
              [req.user.id]
            );

            if (userRows.length > 0) {
              const currentUser = userRows[0];
              responseData.reader = {
                points: Number(currentUser.points || 0),
                gained_exp: gainedExp,
                is_membership: !!currentUser.is_membership,
                membership_active: !!currentUser.membership_active,
                membership_expires_at: currentUser.membership_expires_at,
              };
            }
          } catch (awardError) {
            console.warn('Failed awarding chapter exp:', awardError.message);
          }
        }

        return res.json({
          status: true,
          data: responseData,
        });
      }
    }

    res.status(404).json({ error: 'Chapter not found' });
  } catch (error) {
    console.error('Error fetching chapter:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const listByManga = async (req, res) => {
  try {
    const { mangaId } = req.params;
    const [chapters] = await db.execute(
      `
      SELECT c.*, COUNT(ci.id) as image_count
      FROM chapters c
      LEFT JOIN chapter_images ci ON c.id = ci.chapter_id
      WHERE c.manga_id = ?
      GROUP BY c.id
      ORDER BY c.chapter_number
    `,
      [mangaId]
    );

    res.json(chapters);
  } catch (error) {
    console.error('Error fetching chapters:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const create = async (req, res) => {
  try {
    const { mangaId } = req.params;
    const { title, chapter_number } = req.body;
    let cover = null;
    if (req.file) {
      const ext = path.extname(req.file.originalname || req.file.filename || '') || '.webp';
      const key = `komiknesia/chapters/${mangaId}/cover-${Date.now()}${ext}`;
      cover = await uploadFileToS3(key, req.file.path, req.file.mimetype);
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    }

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

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, chapter_number } = req.body;

    const [chapterRows] = await db.execute('SELECT manga_id FROM chapters WHERE id = ?', [id]);
    if (chapterRows.length === 0) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    const [mangaRows] = await db.execute('SELECT slug FROM manga WHERE id = ?', [
      chapterRows[0].manga_id,
    ]);
    if (mangaRows.length === 0) {
      return res.status(404).json({ error: 'Manga not found' });
    }

    const mangaSlug = mangaRows[0].slug;
    const chapterSlug = `${mangaSlug}-chapter-${chapter_number}`;

    let query = 'UPDATE chapters SET title = ?, chapter_number = ?, slug = ?';
    const params = [title, chapter_number, chapterSlug];

    if (req.file) {
      const ext = path.extname(req.file.originalname || req.file.filename || '') || '.webp';
      const key = `komiknesia/chapters/${chapterRows[0].manga_id}/cover-${Date.now()}${ext}`;
      const url = await uploadFileToS3(key, req.file.path, req.file.mimetype);
      query += ', cover = ?';
      params.push(url);
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    }

    query += ' WHERE id = ?';
    params.push(id);

    await db.execute(query, params);

    res.json({ message: 'Chapter updated successfully' });
  } catch (error) {
    console.error('Error updating chapter:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const destroy = async (req, res) => {
  try {
    const { id } = req.params;

    const [chapterRows] = await db.execute(
      'SELECT cover, manga_id FROM chapters WHERE id = ?',
      [id]
    );

    if (chapterRows.length === 0) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    const chapter = chapterRows[0];

    const [mangaRows] = await db.execute(
      'SELECT is_input_manual FROM manga WHERE id = ?',
      [chapter.manga_id]
    );

    if (mangaRows.length > 0 && mangaRows[0].is_input_manual) {
      deleteFile(chapter.cover);
      try {
        await deleteUrlFromS3(chapter.cover);
      } catch (e) {
        console.warn('Failed deleting chapter cover from S3:', e.message);
      }

      const [images] = await db.execute(
        'SELECT image_path FROM chapter_images WHERE chapter_id = ?',
        [id]
      );

      for (const image of images) {
        deleteFile(image.image_path);
        try {
          await deleteUrlFromS3(image.image_path);
        } catch (e) {
          console.warn('Failed deleting chapter image from S3:', e.message);
        }
      }
    }

    await db.execute('DELETE FROM chapters WHERE id = ?', [id]);
    res.json({ message: 'Chapter deleted successfully' });
  } catch (error) {
    console.error('Error deleting chapter:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const listImages = async (req, res) => {
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
};

const uploadImages = async (req, res) => {
  try {
    const { chapterId } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    const [maxPage] = await db.execute(
      'SELECT COALESCE(MAX(page_number), 0) as max_page FROM chapter_images WHERE chapter_id = ?',
      [chapterId]
    );

    const startPageNumber = maxPage[0].max_page + 1;

    // Upload to S3 first, then insert URLs
    const insertPromises = req.files.map(async (file, index) => {
      const ext = path.extname(file.originalname || file.filename || '') || '.webp';
      const key = `komiknesia/chapters/${chapterId}/pages/${startPageNumber + index}-${Date.now()}${ext}`;
      const url = await uploadFileToS3(key, file.path, file.mimetype);
      try {
        fs.unlinkSync(file.path);
      } catch {}
      return db.execute(
        'INSERT INTO chapter_images (chapter_id, image_path, page_number) VALUES (?, ?, ?)',
        [chapterId, url, startPageNumber + index]
      );
    });

    await Promise.all(insertPromises);

    res.status(201).json({ message: 'Images uploaded successfully' });
  } catch (error) {
    console.error('Error uploading chapter images:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteImage = async (req, res) => {
  try {
    const { chapterId, imageId } = req.params;

    const [images] = await db.execute(
      'SELECT id, image_path FROM chapter_images WHERE id = ? AND chapter_id = ?',
      [imageId, chapterId]
    );

    if (images.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const imagePath = images[0].image_path;

    const [mangaRows] = await db.execute(
      `SELECT m.is_input_manual 
       FROM manga m 
       JOIN chapters c ON m.id = c.manga_id 
       WHERE c.id = ?`,
      [chapterId]
    );

    if (mangaRows.length > 0 && mangaRows[0].is_input_manual) {
      deleteFile(imagePath);
      try {
        await deleteUrlFromS3(imagePath);
      } catch (e) {
        console.warn('Failed deleting chapter image from S3:', e.message);
      }
    }

    await db.execute('DELETE FROM chapter_images WHERE id = ?', [imageId]);

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting chapter image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const reorderImages = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { images } = req.body;

    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Images array is required' });
    }

    for (const image of images) {
      if (!image.id || image.page_number === undefined || image.page_number === null) {
        return res
          .status(400)
          .json({ error: 'Each image must have id and page_number' });
      }
    }

    const imageIds = images.map((img) => parseInt(img.id, 10)).filter((id) => !Number.isNaN(id));

    if (imageIds.length === 0) {
      return res.status(400).json({ error: 'No valid image IDs provided' });
    }

    let existingImages;

    if (imageIds.length === 1) {
      [existingImages] = await db.execute(
        'SELECT id FROM chapter_images WHERE id = ? AND chapter_id = ?',
        [imageIds[0], parseInt(chapterId, 10)]
      );
    } else {
      const placeholders = imageIds.map(() => '?').join(',');
      const query = `SELECT id FROM chapter_images WHERE id IN (${placeholders}) AND chapter_id = ?`;
      const params = [...imageIds, parseInt(chapterId, 10)];

      [existingImages] = await db.execute(query, params);
    }

    if (existingImages.length !== images.length) {
      return res.status(400).json({
        error: 'Some images do not belong to this chapter',
        expected: images.length,
        found: existingImages.length,
      });
    }

    const updatePromises = [];

    for (const image of images) {
      const imageId = parseInt(image.id, 10);
      const pageNumber = parseInt(image.page_number, 10);

      if (Number.isNaN(imageId) || Number.isNaN(pageNumber)) {
        return res.status(400).json({
          error: 'Invalid image data',
          details: `id=${image.id}, page_number=${image.page_number}`,
        });
      }

      updatePromises.push(
        db.execute(
          'UPDATE chapter_images SET page_number = ? WHERE id = ? AND chapter_id = ?',
          [pageNumber, imageId, parseInt(chapterId, 10)]
        )
      );
    }

    await Promise.all(updatePromises);

    res.json({ message: 'Images reordered successfully' });
  } catch (error) {
    console.error('Error reordering chapter images:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
};

module.exports = {
  showBySlug,
  listByManga,
  create,
  update,
  destroy,
  listImages,
  uploadImages,
  deleteImage,
  reorderImages,
};

