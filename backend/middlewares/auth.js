const jwt = require('jsonwebtoken');
const db = require('../db');

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
        username,
        email,
        profile_image,
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
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ status: false, error: 'User not found' });
    }

    req.user = users[0];
    next();
  } catch (error) {
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
        username,
        email,
        profile_image,
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
      [decoded.userId]
    );
    req.user = users.length > 0 ? users[0] : null;
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

