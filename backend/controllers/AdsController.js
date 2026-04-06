/* eslint-disable no-undef */
/* eslint-env node */
const db = require('../db');
const { createShortLivedCache } = require('../utils/shortLivedCache');

const adsListCache = createShortLivedCache({ ttlMs: 60 * 1000, maxKeys: 8 });

const invalidateCache = () => adsListCache.invalidate();

const index = async (req, res) => {
  try {
    const ads = await adsListCache.wrap('list', async () => {
      // Tanpa LIMIT supaya UI edit bisa mengambil ad mana pun.
      const [rows] = await db.execute('SELECT * FROM ads ORDER BY created_at DESC');
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
    const { link_url, ads_type } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    const [result] = await db.execute(
      'INSERT INTO ads (image, link_url, ads_type) VALUES (?, ?, ?)',
      [image, link_url, ads_type]
    );

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
    const { link_url, ads_type, image_alt, title } = req.body;

    let query = 'UPDATE ads SET link_url = ?, ads_type = ?, image_alt = ?, title = ?';
    const params = [link_url || null, ads_type || null, image_alt || null, title || null];

    if (req.file) {
      query += ', image = ?';
      params.push(`/uploads/${req.file.filename}`);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await db.execute(query, params);

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

