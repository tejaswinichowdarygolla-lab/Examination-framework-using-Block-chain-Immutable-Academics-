import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = import.meta.env.VITE_AES_SALT || 'chainedu-v1-salt-2025';

export const EncryptionUtils = {
  /**
   * Encrypts a plaintext string or JSON-stringified object using AES-256.
   */
  encryptData: (data: string | object): string => {
    try {
      const stringData = typeof data === 'object' ? JSON.stringify(data) : data;
      return CryptoJS.AES.encrypt(stringData, ENCRYPTION_KEY).toString();
    } catch (error) {
      console.error("Encryption failed", error);
      throw new Error("Failed to encrypt data.");
    }
  },

  /**
   * Decrypts an AES-256 encrypted string back to plaintext.
   */
  decryptData: (ciphertext: string): string => {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error("Decryption failed", error);
      throw new Error("Failed to decrypt data.");
    }
  },

  /**
   * Decrypts an AES-256 encrypted string directly into a JSON object.
   */
  decryptJSON: <T>(ciphertext: string): T => {
    try {
      const decryptedString = EncryptionUtils.decryptData(ciphertext);
      return JSON.parse(decryptedString) as T;
    } catch (error) {
      console.error("JSON Decryption failed", error);
      throw new Error("Failed to parse decrypted data as JSON.");
    }
  }
};
