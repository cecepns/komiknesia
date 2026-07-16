require('dotenv').config();
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');
const path = require('path');

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: false, // For Cloudflare R2
});

const BUCKET = process.env.S3_BUCKET;
const PUBLIC_DOMAIN = process.env.S3_PUBLIC_DOMAIN;

function getHeadersForUrl(key, url) {
  const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const headers = {
    'User-Agent': DEFAULT_UA,
  };
  
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.toLowerCase();
    
    if (host.includes('apkomik') || host === 'cdnap.site' || key.includes('/apkomik/')) {
      headers['Referer'] = 'https://01.apkomik.com/';
    } else if (host.includes('kiryuu') || host.includes('kiryu') || host === 'yuucdn.com' || host.includes('itachi.my.id') || key.includes('/kiryuu/') || key.includes('/kiryu/')) {
      headers['Referer'] = 'https://v6.kiryuu.to/';
      headers['access-code'] = process.env.IKIRU_CDN_ACCESS_CODE || 'NYQLFxYsnOy+/zwnNWmNTUN5';
      headers['accept'] = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';
    }
  } catch (e) {
    if (url.includes('apkomik') || url.includes('cdnap.site') || key.includes('/apkomik/')) {
      headers['Referer'] = 'https://01.apkomik.com/';
    } else if (url.includes('kiryuu') || url.includes('kiryu') || url.includes('yuucdn') || url.includes('itachi.my.id') || key.includes('/kiryuu/') || key.includes('/kiryu/')) {
      headers['Referer'] = 'https://v6.kiryuu.to/';
      headers['access-code'] = process.env.IKIRU_CDN_ACCESS_CODE || 'NYQLFxYsnOy+/zwnNWmNTUN5';
      headers['accept'] = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';
    }
  }

  return headers;
}

async function uploadUrlToS3(key, url, retries = 3) {
  if (retries === 3) {
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: BUCKET,
        Key: key,
      }));
      console.log(`[s3] File sudah ada di R2, skip upload: ${key}`);
      if (PUBLIC_DOMAIN) {
        const cleanDomain = PUBLIC_DOMAIN.replace(/\/$/, '');
        return `${cleanDomain}/${key}`;
      }
      return `/${key}`;
    } catch (err) {
      if (err.name !== 'NotFound' && err.$metadata?.httpStatusCode !== 404) {
        console.warn(`[s3] Gagal melakukan cek HeadObject untuk ${key}:`, err.message);
      }
    }
  }

  try {
    const headers = getHeadersForUrl(key, url);
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000, headers });
    const buffer = Buffer.from(res.data, 'binary');

    let contentType = res.headers['content-type'];
    if (!contentType) {
      const ext = path.extname(key).toLowerCase();
      if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.webp') contentType = 'image/webp';
      else if (ext === '.gif') contentType = 'image/gif';
      else contentType = 'application/octet-stream';
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // ACL: 'public-read' // Cloudflare R2 might not support ACLs if using bucket policy
    });

    await s3Client.send(command);

    if (PUBLIC_DOMAIN) {
      const cleanDomain = PUBLIC_DOMAIN.replace(/\/$/, '');
      return `${cleanDomain}/${key}`;
    }
    
    // Fallback just returning the key or a constructed R2 domain if no custom domain
    return `/${key}`;

  } catch (error) {
    if (retries > 0) {
      console.warn(`[s3] Retry upload for ${url} (${retries} left)...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return uploadUrlToS3(key, url, retries - 1);
    }
    throw error;
  }
}

module.exports = {
  uploadUrlToS3,
};
