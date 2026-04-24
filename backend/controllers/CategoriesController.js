const db = require('../db');
const { generateSlug } = require('../utils/slug');

const index = async (req, res) => {
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
};

const store = async (req, res) => {
  try {
    const { name, description } = req.body;
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const slug = generateSlug(trimmedName);
    if (!slug) {
      return res.status(400).json({ error: 'Category name is invalid' });
    }

    const [existing] = await db.execute('SELECT id FROM categories WHERE slug = ? LIMIT 1', [slug]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Category with similar name already exists' });
    }

    const [result] = await db.execute(
      'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)',
      [trimmedName, slug, description || null]
    );
    res.status(201).json({ id: result.insertId, message: 'Category created successfully' });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const slug = generateSlug(trimmedName);
    if (!slug) {
      return res.status(400).json({ error: 'Category name is invalid' });
    }

    const [existing] = await db.execute('SELECT id FROM categories WHERE slug = ? AND id != ? LIMIT 1', [
      slug,
      id,
    ]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Category with similar name already exists' });
    }

    await db.execute(
      'UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?',
      [trimmedName, slug, description || null, id]
    );
    res.json({ message: 'Category updated successfully' });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const destroy = async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  index,
  store,
  update,
  destroy,
};

