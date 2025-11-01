/**
 * Client-side password-based encryption utilities
 * Matches the VS Code extension's encryption implementation
 */

const PASSWORD_LENGTH_MIN = 8;
const PASSWORD_LENGTH_MAX = 30;
const ALGORITHM = 'AES-CBC';
const KEY_LENGTH = 256;

/**
 * Note: This implementation uses PBKDF2 for key derivation, which differs from
 * the VS Code extension's use of scrypt. Pastes encrypted in the web UI may not
 * be directly compatible with the VS Code extension's decryption and vice versa.
 * For full compatibility, both would need to use the same key derivation method.
 * 
 * Security: New encryptions use unique random salts per encryption (format version "01").
 * Legacy encryptions using static salt are still supported for backward compatibility.
 */

/**
 * Generate a random password
 * @param length - Length of the password (default: 16)
 * @returns Random password string
 */
export function generateRandomPassword(length: number = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length];
  }
  
  return password;
}

/**
 * Validate password according to requirements
 * @param password - Password to validate
 * @throws Error if password is invalid
 */
function validatePassword(password: string): void {
  if (typeof password !== 'string') {
    throw new TypeError('Password must be a string');
  }
  if (!password) {
    throw new Error('No password provided');
  }
  if (password.length < PASSWORD_LENGTH_MIN) {
    throw new Error(`Password should be at least ${PASSWORD_LENGTH_MIN} characters long.`);
  }
  if (password.length > PASSWORD_LENGTH_MAX) {
    throw new Error(`Password should be less than ${PASSWORD_LENGTH_MAX} characters long.`);
  }
  if (/[\s\t\n\r\v\f\0]/.test(password)) {
    throw new Error('Password should not contain whitespace characters (spaces, tabs, newlines, etc.).');
  }
}

/**
 * Derive a key from a password using Web Crypto API (PBKDF2)
 * @param password - Password to derive key from
 * @param salt - Salt bytes for key derivation (if not provided, uses legacy static salt)
 * @returns CryptoKey for encryption/decryption
 */
async function deriveKeyFromPassword(password: string, salt?: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Use provided salt or fallback to legacy static salt for backward compatibility
  const saltBytes: Uint8Array = salt || encoder.encode('salt');
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt text using a password
 * @param password - Password for encryption
 * @param text - Text to encrypt
 * @returns Hex string containing format version + salt + IV + encrypted data
 *         Format: "01" (version marker) + salt (32 hex chars) + IV (32 hex chars) + encrypted data
 *         Old format (backward compatible): IV (32 hex chars) + encrypted data (no version marker)
 */
export async function encryptWithPassword(password: string, text: string): Promise<string> {
  validatePassword(password);
  
  if (typeof text !== 'string') {
    throw new TypeError('Text must be a string');
  }
  if (!text) {
    throw new Error('Text cannot be empty');
  }

  try {
    // Generate random salt (16 bytes = 32 hex chars) for new format
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(16));
    
    // Derive key from password using the random salt
    const key = await deriveKeyFromPassword(password, salt);
    
    // Encrypt the text
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv: iv },
      key,
      data
    );
    
    // Convert to hex strings
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const encryptedHex = Array.from(new Uint8Array(encrypted))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // New format: version marker "01" + salt + IV + encrypted data
    return '01' + saltHex + ivHex + encryptedHex;
  } catch (error: any) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt text using a password
 * @param password - Password for decryption
 * @param encryptedText - Hex string containing format version + salt + IV + encrypted data
 *                       Or legacy format: IV + encrypted data (for backward compatibility)
 * @returns Decrypted plain text
 */
export async function decryptWithPassword(password: string, encryptedText: string): Promise<string> {
  validatePassword(password);
  
  if (typeof encryptedText !== 'string') {
    throw new TypeError('Encrypted text must be a string');
  }
  if (!encryptedText) {
    throw new Error('Encrypted text cannot be empty');
  }

  try {
    let salt: Uint8Array | undefined;
    let ivHex: string;
    let encryptedHex: string;
    
    // Check for new format: starts with version marker "01"
    if (encryptedText.length > 66 && encryptedText.startsWith('01')) {
      // New format: "01" + salt (32 hex) + IV (32 hex) + encrypted data
      const saltHex = encryptedText.slice(2, 34); // 2-33 (32 chars)
      ivHex = encryptedText.slice(34, 66); // 34-65 (32 chars)
      encryptedHex = encryptedText.slice(66); // rest
      
      // Convert salt hex to Uint8Array
      salt = new Uint8Array(
        saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );
    } else {
      // Legacy format: IV (32 hex) + encrypted data (no version marker, no salt)
      ivHex = encryptedText.slice(0, 32);
      encryptedHex = encryptedText.slice(32);
      // salt remains undefined, will use legacy static salt
    }
    
    // Convert hex to Uint8Array
    const iv = new Uint8Array(
      ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    
    const encrypted = new Uint8Array(
      encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    
    // Derive key from password (with salt if new format, or legacy static salt)
    const key = await deriveKeyFromPassword(password, salt);
    
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: iv },
      key,
      encrypted
    );
    
    // Convert to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error: any) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

