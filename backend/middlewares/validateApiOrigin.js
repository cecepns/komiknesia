/* global require, module, process */

/**
 * Middleware: validateApiOrigin
 *
 * Protects API endpoints from being scraped by external websites/bots.
 * CORS headers alone are NOT enough because scrapers/bots don't run in a
 * browser and therefore ignore CORS restrictions entirely.
 *
 * Strategy:
 *   - Check the `Origin` and `Referer` request headers.
 *   - If neither header is present → blocked (direct curl/scraper request).
 *   - If at least one header is present but does not match an allowed domain → blocked.
 *   - If the header matches an allowed domain → allowed.
 *
 * Note: This is a soft protection layer. Sophisticated scrapers can spoof
 * headers, but this stops the vast majority of naive scrapers and reduces
 * bandwidth/DB load significantly.
 */

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://komiknesia.vercel.app',
  'https://komiknesia.net',
  'https://www.komiknesia.asia',
  'https://02.komiknesia.asia',
  'https://www.02.komiknesia.asia',
  'https://id.komiknesia.net',
  'https://v1.komiknesiaku.com',
  'https://v2.komiknesia.site',
  'https://v3.komiknesia.site',
  'https://v4.komiknesia.site',
  'https://v5.komiknesia.site',
  'https://v6.komiknesia.site',
  'https://v7.komiknesia.site',
  'https://v8.komiknesia.site',
  'https://v9.komiknesia.site',
];

// Pre-compute hostname list for Referer matching (Referer includes the full URL path)
const ALLOWED_HOSTNAMES = ALLOWED_ORIGINS.map((o) => {
  try {
    return new URL(o).hostname;
  } catch {
    return null;
  }
}).filter(Boolean);

/**
 * Extract hostname from an Origin or Referer header value.
 * Returns null if the value is invalid or cannot be parsed.
 */
function extractHostname(value) {
  if (!value) return null;
  try {
    // Origin header: "https://example.com"
    // Referer header: "https://example.com/some/path"
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

/**
 * Returns true when the given hostname belongs to an allowed domain.
 */
function isAllowedHostname(hostname) {
  if (!hostname) return false;
  return ALLOWED_HOSTNAMES.includes(hostname);
}

/**
 * Returns true when the given full origin string exactly matches
 * one of the allowed origins.
 */
function isAllowedOrigin(origin) {
  if (!origin) return false;
  // Strip trailing slash for safety
  const normalized = origin.replace(/\/$/, '');
  return ALLOWED_ORIGINS.includes(normalized);
}

/**
 * The middleware factory.
 * Usage: app.use('/api/manga', validateApiOrigin(), mangaRoutes);
 */
function validateApiOrigin() {
  return function (req, res, next) {
    // Always allow OPTIONS (preflight) – CORS middleware handles these
    if (req.method === 'OPTIONS') return next();

    const origin = req.headers['origin'];
    const referer = req.headers['referer'];

    // --- Check Origin header ---
    if (origin) {
      if (isAllowedOrigin(origin)) return next();
      return res
        .status(403)
        .json({ status: false, error: 'Access denied: unauthorized origin.' });
    }

    // --- Check Referer header (fallback when Origin is absent) ---
    if (referer) {
      const hostname = extractHostname(referer);
      if (isAllowedHostname(hostname)) return next();
      return res
        .status(403)
        .json({ status: false, error: 'Access denied: unauthorized referer.' });
    }

    // --- No Origin or Referer → block unconditionally ---
    return res.status(403).json({
      status: false,
      error: 'Access denied: direct API access is not permitted.',
    });
  };
}

module.exports = { validateApiOrigin };
