const jwt = require('jsonwebtoken');
const db = require('../db');
const { resolveUserRole } = require('../utils/userRole');

const JWT_SECRET = 'komiknesia-secret-key-change-in-production';

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ status: false, error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const [users] = await db.execute(
      `SELECT
        id,
        name,
        username,
        email,
        bio,
        profile_image,
        points,
        is_membership,
        membership_expires_at,
        role,
        CASE
          WHEN is_membership = 1 AND (membership_expires_at IS NULL OR membership_expires_at >= NOW())
          THEN 1
          ELSE 0
        END AS membership_active
      FROM users
      WHERE id = ?`,
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ status: false, error: 'User not found' });
    }

    const row = users[0];
    req.user = {
      ...row,
      role: resolveUserRole(row.role, decoded.role),
    };
    next();
  } catch {
    return res.status(403).json({ status: false, error: 'Invalid or expired token' });
  }
};

const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const [users] = await db.execute(
      `SELECT
        id,
        name,
        username,
        email,
        bio,
        profile_image,
        points,
        is_membership,
        membership_expires_at,
        role,
        CASE
          WHEN is_membership = 1 AND (membership_expires_at IS NULL OR membership_expires_at >= NOW())
          THEN 1
          ELSE 0
        END AS membership_active
      FROM users
      WHERE id = ?`,
      [decoded.userId]
    );
    if (users.length === 0) {
      req.user = null;
    } else {
      const row = users[0];
      req.user = {
        ...row,
        role: resolveUserRole(row.role, decoded.role),
      };
    }
    next();
  } catch {
    req.user = null;
    next();
  }
};

module.exports = {
  JWT_SECRET,
  authenticateToken,
  optionalAuthenticate,
};

