const bcrypt = require('bcryptjs');
const db = require('../db');

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }
  return false;
};

const parseNullableDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const ALLOWED_ROLES = new Set(['user', 'admin']);

const listUsers = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const offset = (page - 1) * limit;

    const params = [];
    let whereSql = '';
    if (search) {
      whereSql = 'WHERE LOWER(u.username) LIKE ? OR LOWER(COALESCE(u.email, "")) LIKE ?';
      const keyword = `%${search.toLowerCase()}%`;
      params.push(keyword, keyword);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM users u
       ${whereSql}`,
      params
    );

    const [rows] = await db.execute(
      `SELECT
          u.id,
          u.username,
          u.email,
          u.points,
          u.is_membership,
          u.membership_expires_at,
          u.profile_image,
          u.created_at,
          u.role
       FROM users u
       ${whereSql}
       ORDER BY u.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      status: true,
      data: {
        items: rows.map((row) => ({
          ...row,
          is_membership: !!row.is_membership,
          points: Number(row.points || 0),
          role: row.role || 'user',
        })),
        pagination: {
          page,
          limit,
          total: Number(countRows[0]?.total || 0),
        },
      },
    });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const createUser = async (req, res) => {
  try {
    const { username, password, email, points, is_membership, membership_expires_at, role } =
      req.body || {};
    const usernameTrim = String(username || '').trim();
    const emailTrim = String(email || '').trim();
    const passwordVal = String(password || '');
    const pointsVal = Number.isFinite(Number(points)) ? Math.max(0, parseInt(points, 10)) : 0;
    const membershipVal = parseBoolean(is_membership);
    const membershipExpireDate = parseNullableDate(membership_expires_at);

    if (!usernameTrim || usernameTrim.length < 3) {
      return res.status(400).json({ status: false, error: 'Username minimal 3 karakter' });
    }
    if (!passwordVal || passwordVal.length < 6) {
      return res.status(400).json({ status: false, error: 'Password minimal 6 karakter' });
    }

    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))',
      [usernameTrim]
    );
    if (existingUsers.length > 0) {
      return res.status(400).json({ status: false, error: 'Username sudah digunakan' });
    }

    if (emailTrim) {
      const [existingEmails] = await db.execute(
        'SELECT id FROM users WHERE email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(?))',
        [emailTrim]
      );
      if (existingEmails.length > 0) {
        return res.status(400).json({ status: false, error: 'Email sudah digunakan' });
      }
    }

    let roleVal = 'user';
    if (role !== undefined && role !== null && String(role).trim() !== '') {
      const r = String(role).trim().toLowerCase();
      if (!ALLOWED_ROLES.has(r)) {
        return res.status(400).json({ status: false, error: 'Role harus "user" atau "admin"' });
      }
      roleVal = r;
    }
    const hashedPassword = await bcrypt.hash(passwordVal, 10);
    await db.execute(
      `INSERT INTO users (username, password, email, points, is_membership, membership_expires_at, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        usernameTrim,
        hashedPassword,
        emailTrim || null,
        pointsVal,
        membershipVal ? 1 : 0,
        membershipVal ? membershipExpireDate : null,
        roleVal,
      ]
    );

    res.json({ status: true, message: 'User berhasil ditambahkan' });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const updateUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { username, email, password, points, is_membership, membership_expires_at, role } =
      req.body || {};
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ status: false, error: 'Invalid user id' });
    }

    const [users] = await db.execute(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [userId]
    );
    if (users.length === 0) {
      return res.status(404).json({ status: false, error: 'User tidak ditemukan' });
    }

    const updates = [];
    const params = [];

    if (typeof username === 'string') {
      const usernameTrim = username.trim();
      if (!usernameTrim || usernameTrim.length < 3) {
        return res.status(400).json({ status: false, error: 'Username minimal 3 karakter' });
      }
      const [existingUsers] = await db.execute(
        'SELECT id FROM users WHERE id != ? AND LOWER(TRIM(username)) = LOWER(TRIM(?))',
        [userId, usernameTrim]
      );
      if (existingUsers.length > 0) {
        return res.status(400).json({ status: false, error: 'Username sudah digunakan' });
      }
      updates.push('username = ?');
      params.push(usernameTrim);
    }

    if (typeof email === 'string') {
      const emailTrim = email.trim();
      if (emailTrim) {
        const [existingEmails] = await db.execute(
          'SELECT id FROM users WHERE id != ? AND email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(?))',
          [userId, emailTrim]
        );
        if (existingEmails.length > 0) {
          return res.status(400).json({ status: false, error: 'Email sudah digunakan' });
        }
      }
      updates.push('email = ?');
      params.push(emailTrim || null);
    }

    if (typeof password === 'string' && password.trim()) {
      if (password.length < 6) {
        return res.status(400).json({ status: false, error: 'Password minimal 6 karakter' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      params.push(hashedPassword);
    }

    if (points !== undefined) {
      const pointsVal = Number.isFinite(Number(points)) ? Math.max(0, parseInt(points, 10)) : 0;
      updates.push('points = ?');
      params.push(pointsVal);
    }

    if (is_membership !== undefined || membership_expires_at !== undefined) {
      const membershipVal = parseBoolean(is_membership);
      const membershipExpireDate = parseNullableDate(membership_expires_at);
      updates.push('is_membership = ?');
      params.push(membershipVal ? 1 : 0);
      updates.push('membership_expires_at = ?');
      params.push(membershipVal ? membershipExpireDate : null);
    }

    if (role !== undefined) {
      const nextRole = String(role).trim().toLowerCase();
      if (!ALLOWED_ROLES.has(nextRole)) {
        return res.status(400).json({ status: false, error: 'Role harus "user" atau "admin"' });
      }
      if (
        userId === req.user.id &&
        String(users[0].role || 'user').toLowerCase() === 'admin' &&
        nextRole === 'user'
      ) {
        return res.status(400).json({
          status: false,
          error: 'Tidak bisa menghapus role admin dari akun yang sedang dipakai',
        });
      }
      updates.push('role = ?');
      params.push(nextRole);
    }

    if (updates.length === 0) {
      return res.status(400).json({ status: false, error: 'Tidak ada data untuk diubah' });
    }

    await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...params, userId]);
    res.json({ status: true, message: 'User berhasil diperbarui' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ status: false, error: 'Invalid user id' });
    }

    if (req.user?.id === userId) {
      return res.status(400).json({ status: false, error: 'Tidak bisa menghapus akun yang sedang dipakai' });
    }

    const [result] = await db.execute('DELETE FROM users WHERE id = ?', [userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: false, error: 'User tidak ditemukan' });
    }

    res.json({ status: true, message: 'User berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
};
