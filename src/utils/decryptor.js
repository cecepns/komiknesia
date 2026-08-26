import CryptoJS from 'crypto-js';

/**
 * Class for decrypting AES-CBC encrypted data from Komiknesia API
 */
export class Decryptor {
  constructor() {
    this.key = null;
    this.currentTimeInt = null;
  }

  /**
   * Initialize the decryptor with the current time integer
   * @param {number} currentTimeInt - The current time integer from the response
   */
  init(currentTimeInt) {
    this.currentTimeInt = currentTimeInt;
    this.key = this.generateKey(currentTimeInt);
  }

  /**
   * Generate the encryption key from the current time integer
   * @param {number} currentTimeInt - The current time integer
   * @returns {string} The generated encryption key
   */
  generateKey(currentTimeInt) {
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
   * Decrypt the encrypted data
   * @param {string} encryptedData - The base64 encoded encrypted data (IV + Ciphertext)
   * @returns {any} The decrypted data
   */
  decrypt(encryptedData) {
    if (!this.key) {
      throw new Error('Decryptor not initialized. Call init() first.');
    }

    try {
      // Convert the base64 string to a WordArray
      const encrypted = CryptoJS.enc.Base64.parse(encryptedData);

      // Extract the IV (first 16 bytes = 4 words) and ciphertext (rest)
      const iv = CryptoJS.lib.WordArray.create(encrypted.words.slice(0, 4), 16);
      const ciphertext = CryptoJS.lib.WordArray.create(
        encrypted.words.slice(4),
        encrypted.sigBytes - 16
      );

      // Convert key to WordArray
      const key = CryptoJS.enc.Utf8.parse(this.key);

      // Create CipherParams object
      const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: ciphertext,
        key: key,
        iv: iv,
        algorithm: CryptoJS.algo.AES,
        padding: CryptoJS.pad.Pkcs7,
        blockSize: 4,
      });

      // Decrypt
      const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      // Convert to string and parse JSON
      const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decryptedStr);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw error;
    }
  }
}

/**
 * Helper function to decrypt encrypted response address/payload
 * @param {string} encryptedData - The base64 encoded encrypted string
 * @param {number} currentTimeInt - The timestamp integer from response
 * @returns {any} Decrypted object
 */
export const decryptResponseAddress = (encryptedData, currentTimeInt) => {
  const decryptor = new Decryptor();
  decryptor.init(currentTimeInt);
  return decryptor.decrypt(encryptedData);
};
