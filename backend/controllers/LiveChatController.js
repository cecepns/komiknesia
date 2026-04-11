/* global require, module */
const db = require('../db');

const MAX_LIMIT = 100;
const MAX_MESSAGE_LENGTH = 300;

const index = async (req, res) => {
  try {
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Math.max(1, Math.min(MAX_LIMIT, Number.isNaN(limitRaw) ? MAX_LIMIT : limitRaw));

    const [rows] = await db.execute(
      `SELECT
        c.id,
        c.user_id,
        c.message,
        c.created_at,
        u.username,
        u.name,
        u.profile_image
      FROM live_chat_messages c
      JOIN users u ON u.id = c.user_id
      ORDER BY c.id DESC
      LIMIT ?`,
      [limit]
    );

    res.json({
      status: true,
      data: rows.reverse(),
    });
  } catch (error) {
    console.error('Error fetching live chat:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const store = async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();

    if (!message) {
      return res.status(400).json({ status: false, error: 'Pesan tidak boleh kosong' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        status: false,
        error: `Pesan terlalu panjang (maksimal ${MAX_MESSAGE_LENGTH} karakter)`,
      });
    }

    const [result] = await db.execute(
      'INSERT INTO live_chat_messages (user_id, message) VALUES (?, ?)',
      [req.user.id, message]
    );

    const [rows] = await db.execute(
      `SELECT
        c.id,
        c.user_id,
        c.message,
        c.created_at,
        u.username,
        u.name,
        u.profile_image
      FROM live_chat_messages c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = ?`,
      [result.insertId]
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('live-chat:new-message', rows[0]);
    }

    res.json({ status: true, data: rows[0] });
  } catch (error) {
    console.error('Error posting live chat message:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = {
  index,
  store,
};

