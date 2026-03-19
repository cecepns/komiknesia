const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middlewares/auth');

const register = async (req, res) => {
  try {
    const { username, password, email } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ status: false, error: 'Username dan password wajib diisi' });
    }

    const usernameTrim = String(username).trim();
    if (usernameTrim.length < 3) {
      return res.status(400).json({ status: false, error: 'Username minimal 3 karakter' });
    }

    const usernameLower = usernameTrim.toLowerCase();
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
      'INSERT INTO users (username, password, email, profile_image) VALUES (?, ?, ?, ?)',
      [usernameLower, hashedPassword, emailVal, profileImage]
    );

    const [inserted] = await db.execute(
      'SELECT id, username, email, profile_image FROM users WHERE id = LAST_INSERT_ID()'
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
          username: user.username,
          email: user.email || null,
          profile_image: user.profile_image || null,
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
      'SELECT id, username, email, password, profile_image FROM users WHERE username = ? OR email = ?',
      [username, username]
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
          username: user.username,
          email: user.email,
          profile_image: user.profile_image || null,
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
        username: req.user.username,
        email: req.user.email,
        profile_image: req.user.profile_image || null,
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
    const { username, email, current_password, new_password } = req.body || {};

    const [users] = await db.execute(
      'SELECT id, username, email, password, profile_image FROM users WHERE id = ?',
      [userId]
    );
    if (users.length === 0) {
      return res.status(404).json({ status: false, error: 'User not found' });
    }
    const currentUser = users[0];

    const updates = [];
    const params = [];

    const usernameTrim = typeof username === 'string' ? username.trim() : '';
    const emailTrim = typeof email === 'string' ? email.trim() : '';

    if (
      usernameTrim &&
      usernameTrim.toLowerCase() !== String(currentUser.username || '').trim().toLowerCase()
    ) {
      if (usernameTrim.length < 3) {
        return res.status(400).json({ status: false, error: 'Username minimal 3 karakter' });
      }

      const [existing] = await db.execute(
        'SELECT id FROM users WHERE id != ? AND (LOWER(TRIM(username)) = LOWER(TRIM(?)) OR (email IS NOT NULL AND TRIM(?) != "" AND LOWER(TRIM(email)) = LOWER(TRIM(?))))',
        [userId, usernameTrim, emailTrim || '', emailTrim || '']
      );
      if (existing.length > 0) {
        return res.status(400).json({
          status: false,
          error: 'Username atau email sudah dipakai pengguna lain.',
        });
      }
      updates.push('username = ?');
      params.push(usernameTrim);
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
      'SELECT id, username, email, profile_image FROM users WHERE id = ?',
      [userId]
    );
    const updated = updatedUsers[0];

    res.json({
      status: true,
      data: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        profile_image: updated.profile_image || null,
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = {
  register,
  login,
  me,
  updateProfile,
};

