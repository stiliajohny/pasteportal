import { getCorsHeaders } from './cors';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';

/**
 * Generate a UUID v4 identifier using cryptographically secure random generation
 * @returns UUID v4 string (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
export function generatePasteId(): string {
  // Use crypto.randomUUID() for cryptographically secure UUID generation
  // Falls back to crypto.randomBytes() if randomUUID() is not available
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Fallback: Generate UUID v4 manually using crypto.randomBytes()
  const bytes = crypto.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
  
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-');
}

/**
 * Hash paste content using SHA-256 for duplicate detection
 * Content is normalized (trimmed) before hashing to catch near-duplicates
 * @param content - Paste content to hash
 * @returns SHA-256 hash as hex string (64 characters)
 */
export function hashPasteContent(content: string): string {
  if (typeof content !== 'string') {
    throw new TypeError('Content must be a string');
  }
  
  // Normalize content: trim leading/trailing whitespace
  // This catches accidental whitespace differences that would otherwise create different hashes
  const normalized = content.trim();
  
  // Generate SHA-256 hash
  const hash = crypto.createHash('sha256');
  hash.update(normalized, 'utf8');
  
  // Return hex string (64 characters)
  return hash.digest('hex');
}

/**
 * Generate a random banter comment/joke
 * @returns A random programming joke
 */
export function generateBanterComment(): string {
  const comments = [
    "Debugging is like being a detective in a mystery movie where you're also the murderer.",
    "Why do programmers prefer dark mode? Less bright light when staring at their screen for hours.",
    "Debugging is like trying to find a needle in a haystack, except the needle is also made of hay.",
    "Why do developers always mix up Halloween and Christmas? Because Oct 31 equals Dec 25.",
    "Why was the JavaScript developer sad? He didn't know how to 'null'.",
    "Why do programmers always mix up Thanksgiving and Christmas? Because Nov 25 equals Dec 25.",
  ];
  return comments[Math.floor(Math.random() * comments.length)];
}

/**
 * Sensitive data patterns to filter from logs
 * These patterns help identify and redact sensitive information
 */
const SENSITIVE_PATTERNS = [
  /password[=:]\s*['"]?([^'"\s]+)/gi,
  /token[=:]\s*['"]?([^'"\s]+)/gi,
  /key[=:]\s*['"]?([^'"\s]+)/gi,
  /secret[=:]\s*['"]?([^'"\s]+)/gi,
  /api[_-]?key[=:]\s*['"]?([^'"\s]+)/gi,
  /authorization[=:]\s*['"]?([^'"\s]+)/gi,
  /auth[_-]?token[=:]\s*['"]?([^'"\s]+)/gi,
  /encryption[_-]?key[=:]\s*['"]?([^'"\s]+)/gi,
  /bearer\s+[\w-]+/gi,
  /[\w-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email addresses
];

/**
 * Redact sensitive information from a string
 * @param text - Text that may contain sensitive data
 * @returns Text with sensitive data redacted
 */
function redactSensitiveData(text: string): string {
  let redacted = text;
  
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, (match) => {
      // Keep first few characters for context, redact the rest
      if (match.length > 10) {
        return match.substring(0, 5) + '***REDACTED***';
      }
      return '***REDACTED***';
    });
  }
  
  return redacted;
}

/**
 * Safely log errors without exposing sensitive data
 * Filters sensitive information like passwords, tokens, keys, etc.
 * @param message - Log message
 * @param error - Error object or data to log
 */
export function secureLogError(message: string, error?: any): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // In production, always filter sensitive data
  // In development, filter sensitive data but allow more detail
  let safeMessage = redactSensitiveData(message);
  let safeError: any = error;
  
  if (error) {
    if (error instanceof Error) {
      safeError = {
        name: error.name,
        message: redactSensitiveData(error.message),
        stack: isProduction ? '[Stack trace redacted in production]' : redactSensitiveData(error.stack || ''),
      };
    } else if (typeof error === 'string') {
      safeError = redactSensitiveData(error);
    } else if (typeof error === 'object') {
      // Deep clone and redact object
      safeError = JSON.parse(JSON.stringify(error));
      const stringified = JSON.stringify(safeError);
      const redactedString = redactSensitiveData(stringified);
      try {
        safeError = JSON.parse(redactedString);
      } catch {
        safeError = redactedString;
      }
    }
  }
  
  if (isProduction) {
    // In production, use structured logging format
    console.error('[ERROR]', safeMessage, safeError || '');
  } else {
    // In development, log with more detail
    console.error(safeMessage, safeError || '');
  }
}

/**
 * Sanitize error messages for client responses
 * In production, returns generic messages to prevent information disclosure
 * In development, returns detailed error messages for debugging
 * @param error - Error object or error message string
 * @param defaultMessage - Default generic message to return in production
 * @returns Sanitized error message safe for client consumption
 */
export function sanitizeError(error: any, defaultMessage: string = 'An error occurred'): string {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Use secure logging for server-side error tracking
  if (isProduction) {
    secureLogError('Error occurred (not exposed to client)', error);
  } else {
    secureLogError('Error details', error);
  }
  
  // In production, never expose detailed error information to client
  if (isProduction) {
    return defaultMessage;
  }
  
  // In development, allow detailed errors for debugging (but still sanitized)
  if (error instanceof Error) {
    return redactSensitiveData(error.message);
  }
  
  if (typeof error === 'string') {
    return redactSensitiveData(error);
  }
  
  if (error?.message) {
    return redactSensitiveData(String(error.message));
  }
  
  return defaultMessage;
}

/**
 * Sanitize user input to prevent XSS and injection attacks
 * Removes or escapes potentially dangerous characters
 * @param input - User-provided string input
 * @param options - Sanitization options
 * @returns Sanitized string
 */
export function sanitizeInput(
  input: string,
  options: {
    maxLength?: number;
    allowNewlines?: boolean;
    allowSpecialChars?: boolean;
  } = {}
): string {
  if (typeof input !== 'string') {
    return '';
  }

  const {
    maxLength = 1000,
    allowNewlines = false,
    allowSpecialChars = true,
  } = options;

  let sanitized = input.trim();

  // Enforce maximum length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove null bytes and control characters (except newlines if allowed)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  if (!allowNewlines) {
    // Remove newlines, carriage returns, tabs
    sanitized = sanitized.replace(/[\r\n\t]/g, ' ');
    // Collapse multiple spaces
    sanitized = sanitized.replace(/\s+/g, ' ');
  }

  // Remove potentially dangerous characters if not explicitly allowed
  if (!allowSpecialChars) {
    // Keep only alphanumeric, spaces, and basic punctuation
    sanitized = sanitized.replace(/[^a-zA-Z0-9\s.,!?\-_@]/g, '');
  }

  return sanitized;
}

/**
 * Sanitize GitHub username to prevent injection
 * GitHub usernames can contain alphanumeric and hyphens, up to 39 characters
 * @param username - GitHub username input
 * @returns Sanitized username or empty string if invalid
 */
export function sanitizeGitHubUsername(username: string): string {
  if (typeof username !== 'string') {
    return '';
  }

  // GitHub username rules:
  // - Only alphanumeric and hyphens
  // - Cannot start or end with hyphen
  // - Maximum 39 characters
  // - Must start with alphanumeric
  const sanitized = username.trim().toLowerCase();
  
  // Validate format
  if (!/^[a-z0-9]([a-z0-9-]{0,37}[a-z0-9])?$/.test(sanitized)) {
    return '';
  }

  return sanitized;
}

/**
 * Sanitize paste name/title
 * Allows alphanumeric, spaces, and common punctuation
 * @param name - Paste name input
 * @returns Sanitized name
 */
export function sanitizePasteName(name: string): string {
  return sanitizeInput(name, {
    maxLength: 200,
    allowNewlines: false,
    allowSpecialChars: true,
  }).replace(/[<>]/g, ''); // Remove angle brackets to prevent HTML injection
}

/**
 * Sanitize tags string (comma-separated values)
 * @param tags - Comma-separated tags string
 * @returns Sanitized tags string
 */
export function sanitizeTags(tags: string): string {
  // Split by comma, trim each tag, filter empty tags, and limit length
  const tagArray = tags
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
    .slice(0, 20) // Limit to 20 tags max
    .map(tag => {
      // Sanitize each tag: remove special characters except hyphens and underscores
      // Limit each tag to 50 characters
      return sanitizeInput(tag.substring(0, 50), {
        maxLength: 50,
        allowNewlines: false,
        allowSpecialChars: false,
      }).replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
    })
    .filter(tag => tag.length > 0);
  
  return tagArray.join(',');
}

/**
 * Validate and sanitize input length
 * @param input - Input string to validate
 * @param maxLength - Maximum allowed length
 * @param minLength - Minimum required length (default: 0)
 * @returns Object with isValid flag and sanitized input
 */
export function validateInputLength(
  input: string,
  maxLength: number,
  minLength: number = 0
): { isValid: boolean; sanitized: string; error?: string } {
  if (typeof input !== 'string') {
    return {
      isValid: false,
      sanitized: '',
      error: 'Input must be a string',
    };
  }

  const trimmed = input.trim();

  if (trimmed.length < minLength) {
    return {
      isValid: false,
      sanitized: trimmed,
      error: `Input must be at least ${minLength} characters`,
    };
  }

  if (trimmed.length > maxLength) {
    return {
      isValid: false,
      sanitized: trimmed.substring(0, maxLength),
      error: `Input must be no more than ${maxLength} characters`,
    };
  }

  return {
    isValid: true,
    sanitized: trimmed,
  };
}

/**
 * Sanitize pasted text content
 * Extracts plain text from HTML/rich text clipboard content
 * Removes formatting while preserving the actual text content
 * @param pastedText - Text content from clipboard (may contain HTML)
 * @returns Sanitized plain text
 */
export function sanitizePastedText(pastedText: string): string {
  if (typeof pastedText !== 'string') {
    return '';
  }

  // Create a temporary DOM element to extract plain text from HTML
  // This handles cases where users paste from rich text sources (Word, web pages, etc.)
  if (typeof document !== 'undefined') {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = pastedText;
    
    // Extract plain text, preserving line breaks
    // Replace <br>, <p>, <div> with newlines
    const brRegex = /<br\s*\/?>/gi;
    const blockElements = /<\/?(p|div|tr|td|th|li|h[1-6]|pre|code|blockquote)[^>]*>/gi;
    
    let plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    // If the original had HTML tags, process them to preserve structure
    if (pastedText.includes('<')) {
      // Replace block elements with newlines
      plainText = pastedText
        .replace(blockElements, '\n')
        .replace(brRegex, '\n');
      
      // Extract text again after processing
      tempDiv.innerHTML = plainText;
      plainText = tempDiv.textContent || tempDiv.innerText || '';
    }
    
    // Normalize line breaks (convert all types to \n)
    plainText = plainText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Remove null bytes and other problematic control characters
    // Keep: \n (newline), \t (tab), and printable characters
    plainText = plainText.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
    
    return plainText;
  }
  
  // Fallback for server-side: basic HTML tag removal
  return pastedText
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Replace &amp; with &
    .replace(/&lt;/g, '<') // Replace &lt; with <
    .replace(/&gt;/g, '>') // Replace &gt; with >
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/&#39;/g, "'") // Replace &#39; with '
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

/**
 * Clipboard permission state
 */
export type ClipboardPermissionState = 'granted' | 'denied' | 'prompt' | 'unavailable';

/**
 * Result of clipboard write operation
 */
export type ClipboardWriteResult = {
  success: boolean;
  error?: string;
  permissionState?: ClipboardPermissionState;
};

/**
 * Check clipboard write permissions
 * @returns Permission state
 */
export async function checkClipboardPermission(): Promise<ClipboardPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return 'unavailable';
  }

  // Check if permissions API is available
  if (typeof navigator.permissions !== 'undefined') {
    try {
      const result = await navigator.permissions.query({ name: 'clipboard-write' as PermissionName });
      return result.state as ClipboardPermissionState;
    } catch (err) {
      // Permissions API might not support clipboard-write in all browsers
      // Fall through to availability check
    }
  }

  // If clipboard API is available, assume prompt state
  // (user hasn't been asked yet or permission is implicit)
  return 'prompt';
}

/**
 * Request clipboard write permissions
 * Attempts to write to clipboard to trigger permission prompt
 * @returns Permission state after request
 */
export async function requestClipboardPermission(): Promise<ClipboardPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return 'unavailable';
  }

  try {
    // Try to write empty string to trigger permission prompt
    // This is a common pattern to request clipboard permissions
    await navigator.clipboard.writeText('');
    return 'granted';
  } catch (err: any) {
    // Check if it's a permission error
    if (err?.name === 'NotAllowedError' || err?.message?.includes('permission')) {
      return 'denied';
    }
    // Other errors might indicate unavailable clipboard
    return 'unavailable';
  }
}

/**
 * Write text to clipboard with permission handling
 * @param text - Text to copy to clipboard
 * @returns Result object with success status and error information
 */
export async function writeToClipboard(text: string): Promise<ClipboardWriteResult> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return {
      success: false,
      error: 'Clipboard API is not available in this browser',
      permissionState: 'unavailable',
    };
  }

  if (!text) {
    return {
      success: false,
      error: 'No text provided to copy',
    };
  }

  try {
    await navigator.clipboard.writeText(text);
    return {
      success: true,
      permissionState: 'granted',
    };
  } catch (err: any) {
    const errorMessage = err?.message || 'Failed to copy to clipboard';
    const isPermissionError = 
      err?.name === 'NotAllowedError' || 
      errorMessage.toLowerCase().includes('permission') ||
      errorMessage.toLowerCase().includes('denied');

    let permissionState: ClipboardPermissionState = 'prompt';
    if (isPermissionError) {
      permissionState = 'denied';
    }

    return {
      success: false,
      error: errorMessage,
      permissionState,
    };
  }
}

/**
 * Maximum allowed request body size (1MB)
 * Used for validating request sizes in API routes
 */
export const MAX_REQUEST_BODY_SIZE = 1024 * 1024; // 1MB

/**
 * Validate request body size
 * @param contentLength - Content-Length header value
 * @param actualSize - Actual body size if already read (optional)
 * @returns Object with isValid flag and error message if invalid
 */
export function validateRequestSize(
  contentLength: string | null,
  actualSize?: number
): { isValid: boolean; error?: string } {
  // Check Content-Length header if available
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > MAX_REQUEST_BODY_SIZE) {
      return {
        isValid: false,
        error: `Request body exceeds maximum size of ${MAX_REQUEST_BODY_SIZE} bytes`,
      };
    }
  }
  
  // Check actual size if provided
  if (actualSize !== undefined && actualSize > MAX_REQUEST_BODY_SIZE) {
    return {
      isValid: false,
      error: `Request body exceeds maximum size of ${MAX_REQUEST_BODY_SIZE} bytes`,
    };
  }
  
  return { isValid: true };
}

/**
 * Generate a standardized API response
 * @param statusCode - HTTP status code
 * @param message - Response message
 * @param data - Optional additional data
 * @param request - Optional NextRequest for CORS header generation
 * @returns Response object
 */
export function generateResponse(
  statusCode: number,
  message: any,
  data?: any,
  request?: NextRequest
): Response {
  // Allow custom headers in CORS: X-Platform, X-Hostname, X-CSRF-Token, Authorization
  const corsHeaders = request 
    ? getCorsHeaders(request, 'GET, POST, PUT, DELETE, OPTIONS', 'Content-Type, X-Platform, X-Hostname, X-CSRF-Token, Authorization')
    : {};
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...corsHeaders,
  };

  const responseBody = JSON.stringify({ response: message });

  return new Response(responseBody, {
    status: statusCode,
    headers,
  });
}
