import { ENV } from '@/config/env';

// SEC-TC-036: Robust slicer to handle abnormally short addresses (test/mock cases)
function safeSlice(addr: string, start: number, length: number): string {
  if (!addr) return "0000";
  const str = addr.toLowerCase();
  if (length > str.length) {
    return str.padEnd(length, '0').slice(0, length);
  }
  return start >= 0 ? str.slice(start, start + length) : str.slice(start);
}

export async function deriveKey(signature: string, walletAddr: string): Promise<CryptoKey> {
  const prefix = safeSlice(walletAddr, 0, 4);
  const suffix = safeSlice(walletAddr, -4, 4);
  
  // SEC-TC-006: Use signature as the root secret (cannot be pre-calculated from bundle)
  // We use the signature + the static salt as PBKDF2 salt for additional security
  const rawKeyMaterial = new TextEncoder().encode(signature);
  
  const baseKey = await crypto.subtle.importKey(
    'raw',
    rawKeyMaterial,
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(ENV.AES_SALT + prefix + suffix),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-CBC', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(str: string): Uint8Array {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

export async function encryptAES(
  plaintext: string,
  key: CryptoKey,
  walletAddr: string,
): Promise<string> {
  const iv  = crypto.getRandomValues(new Uint8Array(16));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  const combined = new Uint8Array(iv.byteLength + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.byteLength);

  const b64 = toBase64(combined.buffer);
  const prefix = safeSlice(walletAddr, 0, 4);
  const suffix = safeSlice(walletAddr, -4, 4);

  return `${prefix}_${b64}_${suffix}`;
}

export async function decryptAES(
  ciphertext: string,
  key: CryptoKey,
  walletAddr: string,
): Promise<string> {
  const parts = ciphertext.split('_');
  if (parts.length < 3) throw new Error('Invalid ciphertext format');
  const b64 = parts.slice(1, -1).join('_');

  const combined = fromBase64(b64);
  const iv         = combined.slice(0, 16);
  const encrypted  = combined.slice(16);

  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    key,
    encrypted,
  );

  return new TextDecoder().decode(plainBuf);
}

export async function sha256Hex(data: string): Promise<string> {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function examPassword(teacherWalletAddr: string): string {
  const prefix = teacherWalletAddr.slice(0, 4).toLowerCase();
  const suffix = teacherWalletAddr.slice(-4).toLowerCase();
  return `exam_${prefix}${suffix}_${ENV.AES_SALT}`;
}

export function resultPassword(studentWalletAddr: string): string {
  const prefix = studentWalletAddr.slice(0, 4).toLowerCase();
  const suffix = studentWalletAddr.slice(-4).toLowerCase();
  return `result_${prefix}${suffix}_${ENV.AES_SALT}`;
}
