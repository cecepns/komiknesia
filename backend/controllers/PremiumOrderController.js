/* eslint-disable no-undef */
/* eslint-env node */
const db = require('../db');
const { deleteFile } = require('../utils/files');

const sanitizeLimit = (value, fallback = 10) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 10);
};

const createOrder = async (req, res) => {
  try {
    const { username, package_id, package_name, package_price } = req.body || {};
    const usernameTrim = String(username || '').trim();
    const packageId = String(package_id || '').trim();
    const packageName = String(package_name || '').trim();
    const packagePrice = String(package_price || '').trim();
    const proofImage = req.file ? `/uploads/${req.file.filename}` : null;

    if (!proofImage) {
      return res.status(400).json({ status: false, error: 'Bukti transfer wajib diupload' });
    }
    if (!usernameTrim) {
      return res.status(400).json({ status: false, error: 'Username akun wajib diisi' });
    }
    if (!packageId || !packageName) {
      return res.status(400).json({ status: false, error: 'Paket premium tidak valid' });
    }

    const [result] = await db.execute(
      `INSERT INTO premium_orders
        (username, package_id, package_name, package_price, proof_image, payment_status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [usernameTrim.slice(0, 100), packageId.slice(0, 50), packageName.slice(0, 120), packagePrice || null, proofImage]
    );

    return res.status(201).json({
      status: true,
      data: {
        id: result.insertId,
        payment_status: 'pending',
      },
      message: 'Order premium berhasil dibuat, menunggu verifikasi admin.',
    });
  } catch (error) {
    console.error('Error creating premium order:', error);
    return res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const listOrders = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim().toLowerCase();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = sanitizeLimit(req.query.limit, 10);
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];
    if (search) {
      where.push('(LOWER(username) LIKE ? OR LOWER(package_name) LIKE ?)');
      const keyword = `%${search}%`;
      params.push(keyword, keyword);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[countRow]] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM premium_orders
       ${whereSql}`,
      params
    );

    const [rows] = await db.execute(
      `SELECT id, username, package_id, package_name, package_price, proof_image, payment_status, created_at
       FROM premium_orders
       ${whereSql}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      status: true,
      data: {
        items: rows,
        pagination: {
          page,
          limit,
          total: Number(countRow?.total || 0),
        },
      },
    });
  } catch (error) {
    console.error('Error listing premium orders:', error);
    return res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const paymentStatus = String(req.body?.payment_status || '').trim().toLowerCase();
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ status: false, error: 'ID order tidak valid' });
    }
    if (!['pending', 'sukses'].includes(paymentStatus)) {
      return res.status(400).json({ status: false, error: 'Status pembayaran tidak valid' });
    }

    const [result] = await db.execute(
      'UPDATE premium_orders SET payment_status = ? WHERE id = ?',
      [paymentStatus, orderId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: false, error: 'Order tidak ditemukan' });
    }

    return res.json({ status: true, message: 'Status pembayaran berhasil diperbarui' });
  } catch (error) {
    console.error('Error updating premium order status:', error);
    return res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ status: false, error: 'ID order tidak valid' });
    }

    const [rows] = await db.execute('SELECT id, proof_image FROM premium_orders WHERE id = ?', [orderId]);
    if (rows.length === 0) {
      return res.status(404).json({ status: false, error: 'Order tidak ditemukan' });
    }

    await db.execute('DELETE FROM premium_orders WHERE id = ?', [orderId]);
    deleteFile(rows[0].proof_image);

    return res.json({ status: true, message: 'Order berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting premium order:', error);
    return res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = {
  createOrder,
  listOrders,
  updateOrderStatus,
  deleteOrder,
};
