/* global require, module */
/**
 * In-memory rate limiting middleware with sliding window per IP.
 */
function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 10,
  message = 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat lagi.',
  statusCode = 429,
  keyGenerator = (req) =>
    req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'global',
} = {}) {
  const hits = new Map();

  // Periodic cleanup every 1 minute to remove expired records
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, 60 * 1000);
  if (interval.unref) interval.unref();

  return (req, res, next) => {
    // Allow CORS preflight requests
    if (req.method === 'OPTIONS') return next();

    const key = keyGenerator(req);
    const now = Date.now();

    let record = hits.get(key);
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      hits.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      res.setHeader('Retry-After', resetSeconds);
      return res.status(statusCode).json({
        status: false,
        error: message,
        retryAfter: resetSeconds,
      });
    }

    next();
  };
}

// Maksimal 5 percobaan register per 15 menit per IP
const registerLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Terlalu banyak percobaan registrasi dari IP Anda. Silakan coba lagi dalam 15 menit.',
});

// Maksimal 15 percobaan login per 5 menit per IP
const loginLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: 'Terlalu banyak percobaan login. Harap tunggu 5 menit sebelum mencoba lagi.',
});

// Global API limiter (300 request per menit per IP)
const globalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message: 'Terlalu banyak request ke server. Harap perlambat permintaan Anda.',
});

module.exports = {
  createRateLimiter,
  registerLimiter,
  loginLimiter,
  globalApiLimiter,
};
