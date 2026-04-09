const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middlewares/auth');

const USERNAME_REGEX = /^[a-z0-9._-]+$/;

const normalizeUsername = (value = '') => String(value).trim().toLowerCase().replace(/\s+/g, '');

const register = async (req, res) => {
  try {
    const { name, username, password, email } = req.body || {};
    if (!name || !username || !password) {
      return res.status(400).json({ status: false, error: 'Nama, username, dan password wajib diisi' });
    }

    const nameTrim = String(name).trim();
    if (!nameTrim) {
      return res.status(400).json({ status: false, error: 'Nama wajib diisi' });
    }

    const usernameLower = normalizeUsername(username);
    if (usernameLower.length < 3) {
      return res.status(400).json({ status: false, error: 'Username minimal 3 karakter' });
    }
    if (!USERNAME_REGEX.test(usernameLower)) {
      return res.status(400).json({
        status: false,
        error: 'Username hanya boleh huruf kecil, angka, titik, underscore, atau dash (tanpa spasi).',
      });
    }
    const emailTrim = email && String(email).trim() ? String(email).trim() : '';

    const [existingUsername] = await db.execute(
      'SELECT id FROM users WHERE LOWER(TRIM(username)) = ?',
      [usernameLower]
    );
    if (existingUsername.length > 0) {
      return res.status(400).json({
        status: false,
        error: 'Username sudah dipakai. Gunakan username lain.',
      });
    }

    if (emailTrim) {
      const [existingEmail] = await db.execute(
        'SELECT id FROM users WHERE email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(?))',
        [emailTrim]
      );
      if (existingEmail.length > 0) {
        return res.status(400).json({
          status: false,
          error: 'Email sudah dipakai. Gunakan email lain.',
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const profileImage = req.file ? `/uploads/${req.file.filename}` : null;
    const emailVal = emailTrim || null;

    await db.execute(
      'INSERT INTO users (name, username, password, email, profile_image) VALUES (?, ?, ?, ?, ?)',
      [nameTrim.slice(0, 100), usernameLower, hashedPassword, emailVal, profileImage]
    );

    const [inserted] = await db.execute(
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
        CASE
          WHEN is_membership = 1 AND (membership_expires_at IS NULL OR membership_expires_at >= NOW())
          THEN 1
          ELSE 0
        END AS membership_active
      FROM users
      WHERE id = LAST_INSERT_ID()`
    );
    const user = inserted[0];

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      status: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name || user.username,
          username: user.username,
          email: user.email || null,
          bio: user.bio || null,
          profile_image: user.profile_image || null,
          points: Number(user.points || 0),
          is_membership: !!user.is_membership,
          membership_expires_at: user.membership_expires_at || null,
          membership_active: !!user.membership_active,
        },
      },
    });
  } catch (error) {
    console.error('Error during register:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ status: false, error: 'Username and password are required' });
    }

    const [users] = await db.execute(
      `SELECT
        id,
        name,
        username,
        email,
        bio,
        password,
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
      WHERE username = ? OR email = ?`,
      [normalizeUsername(username), String(username).trim()]
    );

    if (users.length === 0) {
      return res.status(401).json({ status: false, error: 'Invalid username or password' });
    }

    const user = users[0];

    const isPasswordValid = user.password.startsWith('$2')
      ? await bcrypt.compare(password, user.password)
      : password === user.password;

    if (!isPasswordValid) {
      return res.status(401).json({ status: false, error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      status: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name || user.username,
          username: user.username,
          email: user.email,
          bio: user.bio || null,
          profile_image: user.profile_image || null,
          points: Number(user.points || 0),
          is_membership: !!user.is_membership,
          membership_expires_at: user.membership_expires_at || null,
          membership_active: !!user.membership_active,
        },
      },
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const me = async (req, res) => {
  try {
    res.json({
      status: true,
      data: {
        id: req.user.id,
        name: req.user.name || req.user.username,
        username: req.user.username,
        email: req.user.email,
        bio: req.user.bio || null,
        profile_image: req.user.profile_image || null,
        points: Number(req.user.points || 0),
        is_membership: !!req.user.is_membership,
        membership_expires_at: req.user.membership_expires_at || null,
        membership_active: !!req.user.membership_active,
      },
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profileImage = req.file ? `/uploads/${req.file.filename}` : null;
    const { name, username, email, bio, current_password, new_password } = req.body || {};

    const [users] = await db.execute(
      'SELECT id, name, username, email, bio, password, profile_image FROM users WHERE id = ?',
      [userId]
    );
    if (users.length === 0) {
      return res.status(404).json({ status: false, error: 'User not found' });
    }
    const currentUser = users[0];

    const updates = [];
    const params = [];

    const nameTrim = typeof name === 'string' ? name.trim() : '';
    const usernameLower = typeof username === 'string' ? normalizeUsername(username) : '';
    const emailTrim = typeof email === 'string' ? email.trim() : '';

    if (typeof name === 'string') {
      const nameVal = nameTrim ? nameTrim.slice(0, 100) : null;
      if ((currentUser.name || null) !== nameVal) {
        updates.push('name = ?');
        params.push(nameVal);
      }
    }

    if (
      usernameLower &&
      usernameLower !== String(currentUser.username || '').trim().toLowerCase()
    ) {
      if (usernameLower.length < 3) {
        return res.status(400).json({ status: false, error: 'Username minimal 3 karakter' });
      }
      if (!USERNAME_REGEX.test(usernameLower)) {
        return res.status(400).json({
          status: false,
          error: 'Username hanya boleh huruf kecil, angka, titik, underscore, atau dash (tanpa spasi).',
        });
      }

      const [existing] = await db.execute(
        'SELECT id FROM users WHERE id != ? AND (LOWER(TRIM(username)) = LOWER(TRIM(?)) OR (email IS NOT NULL AND TRIM(?) != "" AND LOWER(TRIM(email)) = LOWER(TRIM(?))))',
        [userId, usernameLower, emailTrim || '', emailTrim || '']
      );
      if (existing.length > 0) {
        return res.status(400).json({
          status: false,
          error: 'Username atau email sudah dipakai pengguna lain.',
        });
      }
      updates.push('username = ?');
      params.push(usernameLower);
    }

    if (emailTrim || email === '') {
      const emailVal = emailTrim || null;
      if (emailVal && emailVal !== currentUser.email) {
        const [existingEmail] = await db.execute(
          'SELECT id FROM users WHERE id != ? AND email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(?))',
          [userId, emailVal]
        );
        if (existingEmail.length > 0) {
          return res.status(400).json({
            status: false,
            error: 'Email sudah dipakai pengguna lain.',
          });
        }
      }
      updates.push('email = ?');
      params.push(emailTrim || null);
    }

    if (typeof bio === 'string') {
      const bioTrimmed = bio.trim();
      const bioVal = bioTrimmed ? bioTrimmed.slice(0, 500) : null;
      if ((currentUser.bio || null) !== bioVal) {
        updates.push('bio = ?');
        params.push(bioVal);
      }
    }

    if (current_password || new_password) {
      if (!current_password || !new_password) {
        return res.status(400).json({
          status: false,
          error: 'Password lama dan password baru wajib diisi',
        });
      }
      if (String(new_password).length < 6) {
        return res.status(400).json({
          status: false,
          error: 'Password baru minimal 6 karakter',
        });
      }

      const isMatch = await bcrypt.compare(String(current_password), currentUser.password);
      if (!isMatch) {
        return res.status(400).json({
          status: false,
          error: 'Password lama tidak sesuai',
        });
      }

      const newHashedPassword = await bcrypt.hash(String(new_password), 10);
      updates.push('password = ?');
      params.push(newHashedPassword);
    }

    if (profileImage) {
      updates.push('profile_image = ?');
      params.push(profileImage);
    }

    if (updates.length > 0) {
      const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
      params.push(userId);
      await db.execute(sql, params);
    }

    const [updatedUsers] = await db.execute(
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
        CASE
          WHEN is_membership = 1 AND (membership_expires_at IS NULL OR membership_expires_at >= NOW())
          THEN 1
          ELSE 0
        END AS membership_active
      FROM users
      WHERE id = ?`,
      [userId]
    );
    const updated = updatedUsers[0];

    res.json({
      status: true,
      data: {
        id: updated.id,
        name: updated.name || updated.username,
        username: updated.username,
        email: updated.email,
        bio: updated.bio || null,
        profile_image: updated.profile_image || null,
        points: Number(updated.points || 0),
        is_membership: !!updated.is_membership,
        membership_expires_at: updated.membership_expires_at || null,
        membership_active: !!updated.membership_active,
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const publicProfile = async (req, res) => {
  try {
    const rawUsername = String(req.params.username || '').trim();
    const username = normalizeUsername(rawUsername);
    if (!username) {
      return res.status(400).json({ status: false, error: 'Username wajib diisi' });
    }

    const [users] = await db.execute(
      `SELECT
        id,
        name,
        username,
        bio,
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
      WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))
      LIMIT 1`,
      [username]
    );

    if (users.length === 0) {
      return res.status(404).json({ status: false, error: 'Profil user tidak ditemukan' });
    }

    const user = users[0];
    return res.json({
      status: true,
      data: {
        id: user.id,
        name: user.name || user.username,
        username: user.username,
        bio: user.bio || null,
        profile_image: user.profile_image || null,
        points: Number(user.points || 0),
        is_membership: !!user.is_membership,
        membership_expires_at: user.membership_expires_at || null,
        membership_active: !!user.membership_active,
      },
    });
  } catch (error) {
    console.error('Error fetching public profile:', error);
    return res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = {
  register,
  login,
  me,
  updateProfile,
  publicProfile,
};

