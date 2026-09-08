/**
 * Cloudflare Worker: Anti-Scrape & Hotlink Protection untuk CDN Komiknesia
 * Mendukung domain proxy: img.cdnesia.my.id
 * Maupun route langsung: data.cdnesia.my.id/*
 */

// 1. Whitelist domain yang diizinkan memuat gambar manga asli
const ALLOWED_DOMAINS = [
  'komiknesia.site',
  'v1.komiknesiaku.com',
  'id.nusakomik.com',
  'localhost',
  '127.0.0.1',
];

// 2. Hostname origin tempat file asli berada
const ORIGIN_HOSTNAME = 'data.cdnesia.my.id';

// 3. URL Gambar Promo jika diakses oleh scraper / web lain
const PROMO_IMAGE_URL = 'https://api-be.komiknesia.my.id/uploads/komiknesia-promo-ganteng.webp';

export default {
  async fetch(request, env, ctx) {
    // Tangani preflight OPTIONS untuk CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    // Hanya proses GET dan HEAD
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const referer = request.headers.get('Referer') || request.headers.get('Origin') || '';

    let isAllowed = false;

    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const host = refererUrl.hostname.toLowerCase();

        // Periksa apakah host cocok dengan salah satu domain yang diizinkan
        isAllowed = ALLOWED_DOMAINS.some(allowed => {
          return host === allowed || host.endsWith('.' + allowed);
        });
      } catch (err) {
        isAllowed = false;
      }
    }

    // =========================================================================
    // JIKA BUKAN DARI DOMAIN RESMI (Scraper / Hotlinker / Bot tanpa Referer)
    // =========================================================================
    if (!isAllowed) {
      return Response.redirect(PROMO_IMAGE_URL, 302);
    }

    // =========================================================================
    // JIKA DARI DOMAIN RESMI (komiknesia.site, v1.komiknesiaku.com, id.nusakomik.com)
    // =========================================================================
    const requestUrl = new URL(request.url);

    // Jika diakses melalui domain worker (misal img.cdnesia.my.id), arahkan target fetch ke data.cdnesia.my.id
    if (requestUrl.hostname !== ORIGIN_HOSTNAME) {
      requestUrl.hostname = ORIGIN_HOSTNAME;
      requestUrl.protocol = 'https:';
    }

    const originResponse = await fetch(requestUrl.toString(), {
      method: request.method,
      headers: request.headers,
    });

    // Tambahkan header CORS agar gambar dapat dibaca oleh frontend resmi
    const responseHeaders = new Headers(originResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: responseHeaders,
    });
  }
};
