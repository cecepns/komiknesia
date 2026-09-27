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
   * Initialize decryptor with response timestamp
   * @param {number} currentTimeInt
   */
  init(currentTimeInt) {
    this.currentTimeInt = currentTimeInt;
    this.key = this.generateKey(currentTimeInt);
  }

  /**
   * Generate key matching backend algorithm
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
   * Decrypt AES-CBC ciphertext
   */
  decrypt(encryptedData) {
    if (!this.key) {
      throw new Error('Decryptor not initialized. Call init() first.');
    }

    try {
      const encrypted = CryptoJS.enc.Base64.parse(encryptedData);

      const iv = CryptoJS.lib.WordArray.create(encrypted.words.slice(0, 4), 16);
      const ciphertext = CryptoJS.lib.WordArray.create(
        encrypted.words.slice(4),
        encrypted.sigBytes - 16
      );

      const key = CryptoJS.enc.Utf8.parse(this.key);

      const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: ciphertext,
        key: key,
        iv: iv,
        algorithm: CryptoJS.algo.AES,
        padding: CryptoJS.pad.Pkcs7,
        blockSize: 4,
      });

      const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decryptedStr);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw error;
    }
  }
}

export const decryptResponseAddress = (encryptedData, currentTimeInt) => {
  const decryptor = new Decryptor();
  decryptor.init(currentTimeInt);
  return decryptor.decrypt(encryptedData);
};
