/* global require, module, process */
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./auth');

/**
 * Middleware: verifyTurnstile
 *
 * Verifies Cloudflare Turnstile gate session token (JWT) or raw token
 * to prevent unauthorized bot scraping and direct API access.
 */
async function verifyTurnstile(req, res, next) {
  // Always allow preflight CORS OPTIONS requests
  if (req.method === 'OPTIONS') return next();

  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "0x4AAAAAAEWaUvw7hJ7ke3d-kdSOCjir6PQ";

  // If secret key is explicitly not configured, allow request
  if (!secretKey) {
    return next();
  }

  // 1. Extract Turnstile token from header or body
  const turnstileToken =
    req.headers['x-turnstile-token'] ||
    req.headers['cf-turnstile-response'] ||
    (req.body && (req.body.turnstileToken || req.body.cfToken || req.body['cf-turnstile-response']));

  if (!turnstileToken) {
    return res.status(403).json({
      status: false,
      error: 'Turnstile verification token is required.',
    });
  }

  // 2. Check if token is a valid Gate Session JWT (Signed by our backend)
  try {
    const decoded = jwt.verify(turnstileToken, JWT_SECRET);
    if (decoded && decoded.turnstileVerified) {
      req.turnstileSession = decoded;
      return next();
    }
  } catch {
    // If not a JWT, it might be a raw one-time Turnstile token directly from Cloudflare
  }

  // 3. Fallback: Verify raw one-time token with Cloudflare API
  try {
    const clientIp =
      req.headers['cf-connecting-ip'] ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;

    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', turnstileToken);
    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const response = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 5000,
      }
    );

    const result = response.data;

    if (!result || !result.success) {
      return res.status(403).json({
        status: false,
        error: 'Turnstile verification failed',
        codes: result ? result['error-codes'] : null,
      });
    }

    req.turnstile = result;
    return next();
  } catch (error) {
    console.error('[Turnstile] Backend verification error:', error.message);
    return res.status(500).json({
      status: false,
      error: 'Turnstile verification server error',
    });
  }
}

module.exports = { verifyTurnstile };
