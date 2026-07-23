import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = import.meta.env.VITE_AES_SALT || 'chainedu-v1-salt-2025';

export const EncryptionUtils = {
  /**
   * AES-256 Encryption
   * Encrypts a plaintext string or object.
   */
  encryptAES: (data: string | object): string => {
    try {
      const stringData = typeof data === 'object' ? JSON.stringify(data) : data;
      return CryptoJS.AES.encrypt(stringData, ENCRYPTION_KEY).toString();
    } catch (error) {
      console.error("AES Encryption failed", error);
      throw new Error("Failed to encrypt data.");
    }
  },

  /**
   * AES-256 Decryption
   * Decrypts an encrypted string back to plaintext.
   */
  decryptAES: (ciphertext: string): string => {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (!decrypted) throw new Error("Decryption resulted in empty string");
      return decrypted;
    } catch (error) {
      console.error("AES Decryption failed", error);
      throw new Error("Failed to decrypt data.");
    }
  },

  /**
   * SHA-256 Hashing
   * Generates a 32-byte hash (hex string with 0x prefix for blockchain compatibility).
   */
  hashSHA256: (data: string): string => {
    try {
      const hash = CryptoJS.SHA256(data);
      return '0x' + hash.toString(CryptoJS.enc.Hex);
    } catch (error) {
      console.error("SHA256 Hashing failed", error);
      throw new Error("Failed to generate hash.");
    }
  },

  /**
   * String to Uint256 (Keccak256)
   * Useful for converting Exam Names to IDs for smart contracts.
   */
  stringToUint256: (input: string): string => {
    const hash = CryptoJS.SHA3(input, { outputLength: 256 });
    return '0x' + hash.toString(CryptoJS.enc.Hex);
  }
};
