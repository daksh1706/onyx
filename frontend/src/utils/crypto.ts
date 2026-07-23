// Native Web Crypto API helpers for password-based local key storage.
// Enforces PBKDF2 key derivation (100,000 iterations, SHA-256) and AES-GCM-256 encryption.

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bufToHex(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a string using a password.
 * @param plaintext The string data to encrypt.
 * @param password The secret passphrase.
 * @returns A JSON string containing hex-encoded ciphertext, salt, and IV.
 */
export async function encryptData(plaintext: string, password: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  
  const key = await deriveKey(password, salt);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as any,
    },
    key,
    encoder.encode(plaintext)
  );

  return JSON.stringify({
    ciphertext: bufToHex(encryptedBuffer),
    iv: bufToHex(iv),
    salt: bufToHex(salt),
  });
}

/**
 * Decrypts a previously encrypted data payload.
 * @param encryptedJson The serialized JSON containing ciphertext, salt, and IV.
 * @param password The secret passphrase.
 * @returns The decrypted plaintext string.
 */
export async function decryptData(encryptedJson: string, password: string): Promise<string> {
  const { ciphertext, iv, salt } = JSON.parse(encryptedJson);
  const saltBuf = hexToBuf(salt);
  const ivBuf = hexToBuf(iv);
  const ciphertextBuf = hexToBuf(ciphertext);
  
  const key = await deriveKey(password, saltBuf);
  const decoder = new TextDecoder();
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBuf as any,
    },
    key,
    ciphertextBuf as any
  );

  return decoder.decode(decryptedBuffer);
}
