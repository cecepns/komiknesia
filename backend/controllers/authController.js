const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const db = require('../db');
const { JWT_SECRET } = require('../middlewares/auth');
const { parseUserRole } = require('../utils/userRole');

const { sendRegisterOtpEmail, sendResetPasswordOtpEmail } = require('../utils/mailer');

const USERNAME_REGEX = /^[a-z0-9._-]+$/;

const normalizeUsername = (value = '') => String(value).trim().toLowerCase().replace(/\s+/g, '');

const sendRegisterOtp = async (req, res) => {
  try {
    const { name, username, email, password } = req.body || {};
    if (!name || !username || !email || !password) {
      return res.status(400).json({
        status: false,
        error: 'Nama, username, email, dan password wajib diisi.',
      });
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

    const emailTrim = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrim)) {
      return res.status(400).json({ status: false, error: 'Format email tidak valid.' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ status: false, error: 'Password minimal 6 karakter.' });
    }

    // Check existing username
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

    // Check existing email
    const [existingEmail] = await db.execute(
      'SELECT id FROM users WHERE email IS NOT NULL AND LOWER(TRIM(email)) = ?',
      [emailTrim]
    );
    if (existingEmail.length > 0) {
      return res.status(400).json({
        status: false,
        error: 'Email sudah terdaftar. Silakan login atau gunakan email lain.',
      });
    }

    // Generate 6 digit OTP
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));

    // Invalidate previous unused OTPs for this email & purpose
    await db.execute(
      'UPDATE email_otps SET is_used = 1 WHERE email = ? AND purpose = "register" AND is_used = 0',
      [emailTrim]
    );

    // Save OTP (valid 10 minutes)
    await db.execute(
      `INSERT INTO email_otps (email, otp_code, purpose, expires_at)
       VALUES (?, ?, 'register', DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [emailTrim, otpCode]
    );

    // Send email
    try {
      await sendRegisterOtpEmail({ to: emailTrim, name: nameTrim, otpCode });
    } catch (mailError) {
      console.error('[sendRegisterOtp] Mail sending failed:', mailError);
      return res.status(500).json({
        status: false,
        error: 'Gagal mengirim email OTP. Pastikan email valid atau coba lagi nanti.',
      });
    }

    return res.json({
      status: true,
      message: `Kode OTP verifikasi telah dikirim ke ${emailTrim}.`,
    });
  } catch (error) {
    console.error('Error during sendRegisterOtp:', error);
    return res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const register = async (req, res) => {
  try {
    const { name, username, password, email, otp_code } = req.body || {};
    if (!name || !username || !password || !email) {
      return res.status(400).json({ status: false, error: 'Nama, username, email, dan password wajib diisi' });
    }

    const emailTrim = String(email).trim().toLowerCase();
    const isMobile =
      Boolean(req.isMobileClient) ||
      req.headers['x-app-client'] === 'komiknesia-mobile' ||
      req.headers['x-app-platform'] === 'android' ||
      req.headers['x-app-platform'] === 'ios' ||
      req.headers['x-app-key'] === 'komiknesia-mobile-app-2026';

    // If OTP is provided or if not on mobile app, require and verify OTP
    if (otp_code && String(otp_code).trim().length > 0) {
      const otpTrim = String(otp_code).trim();
      // Verify OTP
      const [otpRows] = await db.execute(
        `SELECT id FROM email_otps
         WHERE email = ? AND purpose = 'register' AND otp_code = ? AND is_used = 0 AND expires_at >= NOW()
         ORDER BY id DESC LIMIT 1`,
        [emailTrim, otpTrim]
      );

      if (otpRows.length === 0) {
        return res.status(400).json({
          status: false,
          error: 'Kode OTP tidak valid atau sudah kedaluwarsa. Silakan minta kode baru.',
        });
      }

      const otpId = otpRows[0].id;
      // Mark OTP as used
      await db.execute('UPDATE email_otps SET is_used = 1 WHERE id = ?', [otpId]);
    } else if (!isMobile) {
      return res.status(400).json({ status: false, error: 'Kode OTP verifikasi wajib diisi' });
    }
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

    const [existingEmail] = await db.execute(
      'SELECT id FROM users WHERE email IS NOT NULL AND LOWER(TRIM(email)) = ?',
      [emailTrim]
    );
    if (existingEmail.length > 0) {
      return res.status(400).json({
        status: false,
        error: 'Email sudah terdaftar. Gunakan email lain.',
      });
    }

    // Mark OTP as used
    await db.execute('UPDATE email_otps SET is_used = 1 WHERE id = ?', [otpId]);

    const hashedPassword = await bcrypt.hash(password, 10);
    const profileImage = req.file ? `/uploads/${req.file.filename}` : null;

    await db.execute(
      'INSERT INTO users (name, username, password, email, profile_image) VALUES (?, ?, ?, ?, ?)',
      [nameTrim.slice(0, 100), usernameLower, hashedPassword, emailTrim, profileImage]
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
        COALESCE(membership_type, 'web') AS membership_type,
        membership_expires_at,
        role,
        CASE
          WHEN is_membership = 1 AND (membership_expires_at IS NULL OR membership_expires_at >= NOW())
          THEN 1
          ELSE 0
        END AS membership_active
      FROM users
      WHERE id = LAST_INSERT_ID()`
    );
    const user = inserted[0];

    const role = parseUserRole(user.role) || 'user';
    const token = jwt.sign(
      { userId: user.id, username: user.username, role },
      JWT_SECRET,
      { expiresIn: '30d' }
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
          membership_type: user.membership_type || 'web',
          membership_expires_at: user.membership_expires_at || null,
          membership_active: !!user.membership_active,
          role,
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
        COALESCE(membership_type, 'web') AS membership_type,
        membership_expires_at,
        role,
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

    const role = parseUserRole(user.role) || 'user';
    const token = jwt.sign(
      { userId: user.id, username: user.username, role },
      JWT_SECRET,
      { expiresIn: '30d' }
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
          membership_type: user.membership_type || 'web',
          membership_expires_at: user.membership_expires_at || null,
          membership_active: !!user.membership_active,
          role,
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
        membership_type: req.user.membership_type || 'web',
        membership_expires_at: req.user.membership_expires_at || null,
        membership_active: !!req.user.membership_active,
        role: parseUserRole(req.user.role) || 'user',
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
        COALESCE(membership_type, 'web') AS membership_type,
        membership_expires_at,
        role,
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
        membership_type: updated.membership_type || 'web',
        membership_expires_at: updated.membership_expires_at || null,
        membership_active: !!updated.membership_active,
        role: updated.role || 'user',
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

const verifyTurnstileToken = async (req, res) => {
  try {
    const { token } = req.body || {};
    const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "0x4AAAAAAEWaUvw7hJ7ke3d-kdSOCjir6PQ";

    if (!token) {
      return res.status(400).json({ status: false, error: 'Turnstile token is required' });
    }

    const clientIp =
      req.headers['cf-connecting-ip'] ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;

    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const response = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      formData.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 5000,
      }
    );

    const result = response.data;
    if (!result || !result.success) {
      return res.status(403).json({
        status: false,
        error: 'Verifikasi keamanan Turnstile gagal',
        codes: result ? result['error-codes'] : null,
      });
    }

    // Buat Gate Session Token yang berlaku selama 24 jam
    const gateToken = jwt.sign(
      { turnstileVerified: true, verifiedAt: Date.now() },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      status: true,
      gateToken,
    });
  } catch (error) {
    console.error('[Turnstile] Error verifying token:', error.message);
    return res.status(500).json({
      status: false,
      error: 'Terjadi kesalahan saat memverifikasi keamanan server.',
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { identifier } = req.body || {};
    if (!identifier || String(identifier).trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: 'Email atau username wajib diisi.',
      });
    }

    const trimmed = String(identifier).trim().toLowerCase();

    const [users] = await db.execute(
      `SELECT id, name, username, email FROM users
       WHERE (LOWER(TRIM(email)) = ? OR LOWER(TRIM(username)) = ?) AND email IS NOT NULL AND email != ''
       LIMIT 1`,
      [trimmed, trimmed]
    );

    if (users.length === 0) {
      return res.status(404).json({
        status: false,
        error: 'Akun dengan email atau username tersebut tidak ditemukan atau tidak memiliki email terdaftar.',
      });
    }

    const user = users[0];
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));

    // Invalidate previous unused OTPs for this email & reset_password
    await db.execute(
      'UPDATE email_otps SET is_used = 1 WHERE email = ? AND purpose = "reset_password" AND is_used = 0',
      [user.email]
    );

    // Save OTP
    await db.execute(
      `INSERT INTO email_otps (email, otp_code, purpose, expires_at)
       VALUES (?, ?, 'reset_password', DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [user.email, otpCode]
    );

    // Determine frontend URL for direct reset link
    const origin = req.headers.origin || req.headers.referer || process.env.FRONTEND_URL || 'https://komiknesia.asia';
    const frontendBase = String(origin).replace(/\/+$/, '').split('?')[0].replace(/\/akun$/, '');
    const resetLink = `${frontendBase}/akun?mode=reset_password&email=${encodeURIComponent(user.email)}&otp=${otpCode}`;

    // Send email with resetLink and OTP
    try {
      await sendResetPasswordOtpEmail({
        to: user.email,
        name: user.name || user.username,
        otpCode,
        resetLink,
      });
    } catch (mailError) {
      console.error('[forgotPassword] Mail sending failed:', mailError);
      return res.status(500).json({
        status: false,
        error: 'Gagal mengirim email reset password. Silakan coba lagi nanti.',
      });
    }

    // Mask email for user privacy, e.g. "a***d@gmail.com"
    const [localPart, domain] = user.email.split('@');
    const maskedLocal = localPart.length <= 2 ? localPart[0] + '***' : localPart[0] + '***' + localPart[localPart.length - 1];
    const maskedEmail = `${maskedLocal}@${domain}`;

    return res.json({
      status: true,
      message: `Kode reset password telah dikirim ke email ${maskedEmail}.`,
      email: user.email,
      maskedEmail,
    });
  } catch (error) {
    console.error('Error during forgotPassword:', error);
    return res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp_code, new_password } = req.body || {};
    if (!email || !otp_code || !new_password) {
      return res.status(400).json({
        status: false,
        error: 'Email, kode OTP, dan password baru wajib diisi.',
      });
    }

    if (String(new_password).length < 6) {
      return res.status(400).json({
        status: false,
        error: 'Password baru minimal 6 karakter.',
      });
    }

    const emailTrim = String(email).trim().toLowerCase();
    const otpTrim = String(otp_code).trim();

    // Verify OTP
    const [otpRows] = await db.execute(
      `SELECT id FROM email_otps
       WHERE email = ? AND purpose = 'reset_password' AND otp_code = ? AND is_used = 0 AND expires_at >= NOW()
       ORDER BY id DESC LIMIT 1`,
      [emailTrim, otpTrim]
    );

    if (otpRows.length === 0) {
      return res.status(400).json({
        status: false,
        error: 'Kode OTP tidak valid atau sudah kedaluwarsa.',
      });
    }

    const otpId = otpRows[0].id;

    // Check user exists
    const [users] = await db.execute(
      'SELECT id FROM users WHERE LOWER(TRIM(email)) = ?',
      [emailTrim]
    );

    if (users.length === 0) {
      return res.status(404).json({
        status: false,
        error: 'Pengguna tidak ditemukan.',
      });
    }

    const userId = users[0].id;
    const hashedPassword = await bcrypt.hash(String(new_password), 10);

    // Update password
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    // Mark OTP as used
    await db.execute('UPDATE email_otps SET is_used = 1 WHERE id = ?', [otpId]);

    return res.json({
      status: true,
      message: 'Password berhasil diubah. Silakan masuk menggunakan password baru Anda.',
    });
  } catch (error) {
    console.error('Error during resetPassword:', error);
    return res.status(500).json({ status: false, error: 'Internal server error' });
  }
};

module.exports = {
  sendRegisterOtp,
  register,
  login,
  forgotPassword,
  resetPassword,
  me,
  updateProfile,
  publicProfile,
  verifyTurnstileToken,
};

