/* eslint-disable no-undef */
/* eslint-env node */
const db = require('../db');
const { createShortLivedCache } = require('../utils/shortLivedCache');

const adsListCache = createShortLivedCache({ ttlMs: 60 * 1000, maxKeys: 8 });

const invalidateCache = () => adsListCache.invalidate();

const index = async (req, res) => {
  try {
    const ads = await adsListCache.wrap('list', async () => {
      // Order by display_order ASC, then created_at DESC
      const [rows] = await db.execute('SELECT * FROM ads ORDER BY display_order ASC, created_at DESC');
      return rows;
    });
    res.json(ads);
  } catch (error) {
    console.error('Error fetching ads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const store = async (req, res) => {
  try {
    const { link_url, ads_type, expired_at, display_order, image_alt, title, target_platform, media_type, video_url } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const expiredAt = expired_at && String(expired_at).trim() ? expired_at : null;
    const orderVal = display_order !== undefined && display_order !== null ? parseInt(display_order, 10) || 0 : 0;
    const targetPlatform = ['web', 'mobile', 'both'].includes(String(target_platform || '').toLowerCase())
      ? String(target_platform).toLowerCase()
      : 'web';
    const mediaType = ['image', 'video'].includes(String(media_type || '').toLowerCase())
      ? String(media_type).toLowerCase()
      : (image?.match(/\.(mp4|webm|ogg|mov)$/i) || video_url ? 'video' : 'image');
    const videoUrl = video_url && String(video_url).trim() ? String(video_url).trim() : null;

    let result;
    try {
      [result] = await db.execute(
        'INSERT INTO ads (image, link_url, ads_type, image_alt, title, expired_at, display_order, target_platform, media_type, video_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [image, link_url, ads_type, image_alt || null, title || null, expiredAt, orderVal, targetPlatform, mediaType, videoUrl]
      );
    } catch (insertErr) {
      if (insertErr.code === 'ER_BAD_FIELD_ERROR') {
        // Fallback for database schema before migration
        [result] = await db.execute(
          'INSERT INTO ads (image, link_url, ads_type, expired_at, display_order) VALUES (?, ?, ?, ?, ?)',
          [image, link_url, ads_type, expiredAt, orderVal]
        );
      } else {
        throw insertErr;
      }
    }

    invalidateCache();

    res.status(201).json({ id: result.insertId, message: 'Ad created successfully' });
  } catch (error) {
    console.error('Error creating ad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { link_url, ads_type, image_alt, title, expired_at, display_order, target_platform, media_type, video_url } = req.body;

    const expiredAt = expired_at && String(expired_at).trim() ? expired_at : null;
    const orderVal = display_order !== undefined && display_order !== null ? parseInt(display_order, 10) || 0 : 0;
    const targetPlatform = ['web', 'mobile', 'both'].includes(String(target_platform || '').toLowerCase())
      ? String(target_platform).toLowerCase()
      : 'web';
    const mediaType = ['image', 'video'].includes(String(media_type || '').toLowerCase())
      ? String(media_type).toLowerCase()
      : (video_url ? 'video' : 'image');
    const videoUrl = video_url !== undefined ? (String(video_url).trim() || null) : null;

    try {
      let query = 'UPDATE ads SET link_url = ?, ads_type = ?, image_alt = ?, title = ?, expired_at = ?, display_order = ?, target_platform = ?, media_type = ?, video_url = ?';
      const params = [link_url || null, ads_type || null, image_alt || null, title || null, expiredAt, orderVal, targetPlatform, mediaType, videoUrl];

      if (req.file) {
        query += ', image = ?';
        params.push(`/uploads/${req.file.filename}`);
      }

      query += ' WHERE id = ?';
      params.push(id);

      await db.execute(query, params);
    } catch (updateErr) {
      if (updateErr.code === 'ER_BAD_FIELD_ERROR') {
        let query = 'UPDATE ads SET link_url = ?, ads_type = ?, image_alt = ?, title = ?, expired_at = ?, display_order = ?';
        const params = [link_url || null, ads_type || null, image_alt || null, title || null, expiredAt, orderVal];

        if (req.file) {
          query += ', image = ?';
          params.push(`/uploads/${req.file.filename}`);
        }

        query += ' WHERE id = ?';
        params.push(id);

        await db.execute(query, params);
      } else {
        throw updateErr;
      }
    }

    invalidateCache();

    res.json({ message: 'Ad updated successfully' });
  } catch (error) {
    console.error('Error updating ad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const destroy = async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM ads WHERE id = ?', [id]);

    invalidateCache();

    res.json({ message: 'Ad deleted successfully' });
  } catch (error) {
    console.error('Error deleting ad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  index,
  store,
  update,
  destroy,
};

