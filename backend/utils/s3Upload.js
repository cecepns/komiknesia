/* eslint-disable no-undef */
/* eslint-env node */
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const {
  isIkiruCdnUrl,
  isYuuCdnUrl,
  getIkiruCdnFetchHeaders,
  isPromoIkiruResponse,
  IKIRU_CDN_PROXY,
} = require('./ikiruCdnImage');

const S3_ENDPOINT = process.env.S3_ENDPOINT || 'https://33cbe0d28cbe34b858c352c662d477d6.r2.cloudflarestorage.com';
const S3_REGION = process.env.S3_REGION || 'auto';
const S3_BUCKET = process.env.S3_BUCKET || 'komiknesia';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'c004de4fd715fb374dbab19443a9c57d';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'a428f2b13fa3de370549acc643736cf60a2b8c250b67ec286ead25ad51ff0273';
const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL || 'https://cdn.komiknesia.net';

let s3Client = null;
if (S3_BUCKET && S3_ACCESS_KEY && S3_SECRET_KEY) {
  s3Client = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    forcePathStyle: !S3_ENDPOINT.includes('r2.cloudflarestorage.com'),
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY,
    },
  });
}

async function uploadBufferToS3(key, buffer, contentType = 'image/webp') {
  if (!s3Client) {
    throw new Error('S3 belum dikonfigurasi. Set S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY.');
  }

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read',
  });

  await s3Client.send(command);

  // Return only the key (relative path) to be stored in the database
  return key;
}

function guessContentTypeFromExt(ext) {
  switch (String(ext || '').toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

async function uploadFileToS3(key, filePath, contentType) {
  const ext = path.extname(filePath);
  const ct = contentType || guessContentTypeFromExt(ext);
  const buffer = fs.readFileSync(filePath);
  return uploadBufferToS3(key, buffer, ct);
}

async function uploadUrlToS3(key, url, contentType) {
  const defaultHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  };

  const isIkiru = isIkiruCdnUrl(url);
  const isYuu = isIkiru && isYuuCdnUrl(url);

  let resp;
  let directFailedOrPromo = false;

  // For YuuCDN: try a plain direct fetch first (no Ikiru headers, no proxy)
  // since yuucdn.com has closed/disabled proxy restrictions
  if (isYuu) {
    try {
      resp = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxRedirects: 5,
        headers: defaultHeaders,
      });

      const finalUrl = resp.request?.res?.responseUrl || url;
      if (isPromoIkiruResponse(finalUrl, url)) {
        directFailedOrPromo = true;
        resp = null;
      }
    } catch (err) {
      directFailedOrPromo = true;
    }
  } else if (isIkiru) {
    // Non-YuuCDN Ikiru: try direct with Ikiru headers first
    try {
      resp = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxRedirects: 5,
        headers: getIkiruCdnFetchHeaders('https://v6.kiryuu.to/', url),
      });

      const finalUrl = resp.request?.res?.responseUrl || url;
      if (isPromoIkiruResponse(finalUrl, url)) {
        directFailedOrPromo = true;
        resp = null;
      }
    } catch (err) {
      directFailedOrPromo = true;
    }
  }

  // Fallback to proxy if direct failed/redirected for Ikiru CDN (non-YuuCDN only)
  if (!resp || directFailedOrPromo) {
    const useProxyNow = isIkiru && !isYuu;
    let httpsAgent = null;
    const proxyUrl = IKIRU_CDN_PROXY || process.env.OUTBOUND_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
    if (proxyUrl && useProxyNow) {
      try {
        const { HttpsProxyAgent } = require('https-proxy-agent');
        httpsAgent = new HttpsProxyAgent(proxyUrl);
      } catch { }
    }

    resp = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 5,
      headers: useProxyNow ? getIkiruCdnFetchHeaders('https://v6.kiryuu.to/', url) : defaultHeaders,
      ...(httpsAgent ? { httpsAgent } : {})
    });
  }


  const finalUrl = resp.request?.res?.responseUrl || url;
  if (isPromoIkiruResponse(finalUrl, url)) {
    throw new Error('Ikiru CDN returned promo image (access-code/referer rejected)');
  }

  const ct = contentType || resp.headers?.['content-type'] || 'application/octet-stream';
  return uploadBufferToS3(key, Buffer.from(resp.data), ct);
}

function tryParseS3KeyFromUrl(url) {
  if (!url) return null;
  const raw = String(url).trim();
  if (!raw) return null;

  // Raw key already stored (not a URL), e.g. "komiknesia/manga/..."
  if (!/^https?:\/\//i.test(raw)) {
    const normalized = raw.replace(/^\/+/, '');
    if (normalized.startsWith(`${S3_BUCKET}/`)) {
      return normalized;
    }
    return null;
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  const pathname = decodeURIComponent(parsed.pathname || '').replace(/^\/+/, '');
  if (!pathname) return null;

  // If it is a path-style URL on r2.cloudflarestorage.com (starts with komiknesia/komiknesia/)
  if (pathname.startsWith(`${S3_BUCKET}/${S3_BUCKET}/`)) {
    return pathname.slice(S3_BUCKET.length + 1);
  }

  // If it starts with "komiknesia/", that's our key!
  if (pathname.startsWith(`${S3_BUCKET}/`)) {
    return pathname;
  }

  // Fallback for CDN/custom domains that still include /<bucket>/<key> in path
  const bucketSegment = `${S3_BUCKET}/`;
  const bucketIndex = pathname.indexOf(bucketSegment);
  if (bucketIndex >= 0) {
    const key = pathname.slice(bucketIndex + bucketSegment.length);
    if (key.startsWith(`${S3_BUCKET}/`)) {
      return key;
    }
    return `${S3_BUCKET}/${key}`;
  }

  // Last resort: if path already looks like our object key, use it.
  if (pathname.startsWith('komiknesia/')) {
    return pathname;
  }

  return null;
}

async function deleteKeyFromS3(key) {
  if (!s3Client) {
    // Do not block deletes if S3 isn't configured in current env
    return { deleted: false, skipped: true, reason: 'S3 not configured' };
  }
  if (!key) return { deleted: false, skipped: true, reason: 'empty key' };

  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });
  await s3Client.send(command);
  return { deleted: true };
}

async function deleteUrlFromS3(url) {
  const key = tryParseS3KeyFromUrl(url);
  if (!key) return { deleted: false, skipped: true, reason: 'not our S3 url' };
  return deleteKeyFromS3(key);
}

let GLOBAL_CDN_DOMAIN = S3_PUBLIC_URL;

async function refreshCdnDomain() {
  try {
    const db = require('../db');
    const [rows] = await db.execute("SELECT `value` FROM settings WHERE `key` = 'cdn_domain' LIMIT 1");
    if (rows && rows.length > 0 && rows[0].value) {
      GLOBAL_CDN_DOMAIN = rows[0].value.trim();
    }
  } catch (err) {
    // Ignore DB errors during startup
  }
}

// Periodically refresh CDN domain from db (every 10 seconds)
setInterval(refreshCdnDomain, 10000);
// Run once on load
refreshCdnDomain().catch(() => {});

function getDynamicCdnDomainSync() {
  return GLOBAL_CDN_DOMAIN;
}

module.exports = {
  s3Client,
  uploadBufferToS3,
  uploadFileToS3,
  uploadUrlToS3,
  deleteKeyFromS3,
  deleteUrlFromS3,
  tryParseS3KeyFromUrl,
  refreshCdnDomain,
  getDynamicCdnDomainSync,
};

