/* eslint-disable no-undef */
/* eslint-env node */
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const S3_ENDPOINT = process.env.S3_ENDPOINT || 'https://is3.cloudhost.id';
const S3_REGION = process.env.S3_REGION || 'auto';
const S3_BUCKET = process.env.S3_BUCKET || 'data.komikneisa';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || '6VVTGTBLJWBOCA41Z9IT';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'GqwJ0GNPAArraf1vZmhRYDDGyDaXO7kNH8YEwhpo';

let s3Client = null;
if (S3_BUCKET && S3_ACCESS_KEY && S3_SECRET_KEY) {
  s3Client = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    forcePathStyle: true,
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

  return `${S3_ENDPOINT.replace(/\/$/, '')}/${S3_BUCKET}/${key}`;
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
  const resp = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  });
  const ct = contentType || resp.headers?.['content-type'] || 'application/octet-stream';
  return uploadBufferToS3(key, Buffer.from(resp.data), ct);
}

function tryParseS3KeyFromUrl(url) {
  if (!url) return null;
  const raw = String(url);
  const endpoint = S3_ENDPOINT.replace(/\/$/, '');

  if (!raw.startsWith(endpoint)) return null;
  // expected: `${endpoint}/${bucket}/${key}`
  const withoutEndpoint = raw.slice(endpoint.length).replace(/^\/+/, '');
  const parts = withoutEndpoint.split('/');
  if (!parts.length) return null;
  const bucket = parts.shift();
  if (!bucket || bucket !== S3_BUCKET) return null;
  const key = parts.join('/');
  return key || null;
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

module.exports = {
  s3Client,
  uploadBufferToS3,
  uploadFileToS3,
  uploadUrlToS3,
  deleteKeyFromS3,
  deleteUrlFromS3,
  tryParseS3KeyFromUrl,
};

