/* global require, module */
const crypto = require('crypto');

/**
 * Generate 32-byte AES key from timestamp integer
 * Matches the frontend Decryptor implementation
 */
function generateKey(currentTimeInt) {
  let keyValue = Number(currentTimeInt);
  for (let i = 0; i < 5; i++) {
    keyValue = keyValue / 2;
  }
  let keyStr = keyValue.toFixed(8);
  if (keyStr.length < 32) {
    keyStr = keyStr.padEnd(32, '0');
  } else if (keyStr.length > 32) {
    keyStr = keyStr.substring(0, 32);
  }
  return keyStr;
}

/**
 * Encrypt payload using AES-256-CBC with random 16-byte IV prepended
 * @param {any} data - Data to encrypt
 * @param {number} currentTimeInt - Current timestamp in seconds
 */
function encryptPayload(data, currentTimeInt = Math.floor(Date.now() / 1000)) {
  const keyStr = generateKey(currentTimeInt);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(keyStr, 'utf8'), iv);
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
  const combined = Buffer.concat([iv, encrypted]);

  return {
    status: true,
    encrypted: true,
    data: combined.toString('base64'),
    time: currentTimeInt,
  };
}

/**
 * Decrypt payload (for testing or internal verification)
 */
function decryptPayload(encryptedBase64, currentTimeInt) {
  const keyStr = generateKey(currentTimeInt);
  const buffer = Buffer.from(encryptedBase64, 'base64');
  const iv = buffer.subarray(0, 16);
  const ciphertext = buffer.subarray(16);

  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(keyStr, 'utf8'), iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

const { transformUrls, getDynamicCdnDomainSync } = require('./s3Upload');

/**
 * Express middleware to automatically encrypt successful public JSON responses
 */
function encryptResponseMiddleware(req, res, next) {
  const originalJson = res.json;

  res.json = function (body) {
    // Only encrypt if response is successful and not already encrypted
    if (body && typeof body === 'object' && !body.encrypted && body.status !== false) {
      // 1. Transform S3 / CDN URLs first with dynamic CDN domain from settings
      const cdnUrl = getDynamicCdnDomainSync();
      const transformedBody = transformUrls(body, cdnUrl);

      // 2. Encrypt the transformed body
      const encrypted = encryptPayload(transformedBody);
      res.setHeader('X-Encrypted-Response', '1');
      return originalJson.call(this, encrypted);
    }
    return originalJson.call(this, body);
  };

  next();
}

module.exports = {
  generateKey,
  encryptPayload,
  decryptPayload,
  encryptResponseMiddleware,
};
