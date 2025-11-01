import crypto from 'crypto';

/**
 * Get the encryption key from environment variable
 * @returns Buffer containing the encryption key
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  // If key is 32 bytes (64 hex chars), use it directly
  // Otherwise, derive a 32-byte key from it using scrypt
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  
  // Derive a 32-byte key from the provided key
  return crypto.scryptSync(key, 'pasteportal-salt', 32);
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for IV
const SALT_LENGTH = 64; // Length of hex string for IV + auth tag
const AUTH_TAG_LENGTH = 16; // 16 bytes for authentication tag

/**
 * Encrypts text using AES-256-GCM
 * @param text - Plain text to encrypt
 * @returns Hex string containing IV + encrypted data + auth tag
 */
export function encrypt(text: string): string {
  if (!text) {
    throw new Error('Text cannot be empty');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return IV + encrypted data + auth tag as hex string
  return iv.toString('hex') + encrypted + authTag.toString('hex');
}

/**
 * Decrypts text using AES-256-GCM
 * @param encryptedText - Hex string containing IV + encrypted data + auth tag
 * @returns Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    throw new Error('Encrypted text cannot be empty');
  }

  const key = getEncryptionKey();

  // Extract IV, encrypted data, and auth tag
  const ivHex = encryptedText.substring(0, IV_LENGTH * 2);
  const authTagHex = encryptedText.substring(encryptedText.length - AUTH_TAG_LENGTH * 2);
  const encryptedHex = encryptedText.substring(
    IV_LENGTH * 2,
    encryptedText.length - AUTH_TAG_LENGTH * 2
  );

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
