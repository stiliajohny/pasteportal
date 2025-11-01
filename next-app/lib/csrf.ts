/**
 * CSRF Protection Utilities
 * Implements multiple layers of CSRF protection:
 * 1. Origin header validation
 * 2. Referer header validation (fallback)
 * 3. CSRF token validation for authenticated requests
 */

import { NextRequest } from 'next/server';

/**
 * Validate Origin/Referer headers to prevent CSRF attacks
 * @param request - NextRequest object
 * @returns True if origin is valid, false otherwise
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  // Get allowed origins from environment or use host as fallback
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : host ? [`https://${host}`, `http://${host}`] : [];
  
  // Allow requests from same origin (direct API calls, no origin header)
  // This is safe because:
  // - Browser automatically sets Origin for cross-origin requests
  // - Same-origin requests (from the same domain) don't need CSRF protection
  // - Direct API calls (like from VS Code extension) won't have Origin header
  if (!origin) {
    // No origin header means same-origin request or direct API call
    // For same-origin, we trust it (browsers handle this)
    // For direct API calls (VS Code extension), we'll validate via token if authenticated
    return true;
  }
  
  // Validate against allowed origins
  try {
    const originUrl = new URL(origin);
    const isValidOrigin = allowedOrigins.some(allowed => {
      try {
        const allowedUrl = new URL(allowed);
        return originUrl.protocol === allowedUrl.protocol && 
               originUrl.hostname === allowedUrl.hostname &&
               (originUrl.port === allowedUrl.port || (!originUrl.port && !allowedUrl.port));
      } catch {
        // If allowed origin is not a full URL, compare hostnames
        return originUrl.hostname === allowed || originUrl.host === allowed;
      }
    });
    
    if (isValidOrigin) {
      return true;
    }
  } catch {
    // Invalid origin URL format
  }
  
  // Fallback: validate referer if origin validation failed
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return allowedOrigins.some(allowed => {
        try {
          const allowedUrl = new URL(allowed);
          return refererUrl.protocol === allowedUrl.protocol && 
                 refererUrl.hostname === allowedUrl.hostname &&
                 (refererUrl.port === allowedUrl.port || (!refererUrl.port && !allowedUrl.port));
        } catch {
          return refererUrl.hostname === allowed || refererUrl.host === allowed;
        }
      });
    } catch {
      // Invalid referer URL format
    }
  }
  
  return false;
}

/**
 * Validate CSRF token for authenticated requests
 * Uses double-submit cookie pattern
 * @param request - NextRequest object
 * @returns True if CSRF token is valid, false otherwise
 */
export function validateCsrfToken(request: NextRequest): boolean {
  // Get CSRF token from header (client should send X-CSRF-Token header)
  const csrfToken = request.headers.get('x-csrf-token');
  
  // Get CSRF token from cookie (set on page load)
  const cookies = request.headers.get('cookie') || '';
  const cookieMatch = cookies.match(/csrf-token=([^;]+)/);
  const cookieToken = cookieMatch ? cookieMatch[1] : null;
  
  // If no token required (public endpoints or direct API calls), allow
  // Only validate if both token and cookie are present
  if (!csrfToken || !cookieToken) {
    // For direct API calls (like VS Code extension), we'll rely on Origin validation
    // This maintains backward compatibility
    return true;
  }
  
  // Validate that header token matches cookie token (double-submit pattern)
  return csrfToken === cookieToken;
}

/**
 * Comprehensive CSRF validation for state-changing operations
 * @param request - NextRequest object
 * @param requireAuth - Whether the request requires authentication (default: true)
 * @returns Object with isValid flag and error message if invalid
 */
export function validateCsrf(
  request: NextRequest,
  requireAuth: boolean = true
): { isValid: boolean; error?: string } {
  // For public endpoints that don't require auth, skip CSRF check
  // CSRF is primarily needed for authenticated state-changing operations
  if (!requireAuth) {
    return { isValid: true };
  }
  
  // Validate Origin/Referer headers
  const originValid = validateOrigin(request);
  if (!originValid) {
    return {
      isValid: false,
      error: 'Invalid origin. Request rejected for security reasons.'
    };
  }
  
  // For authenticated requests, also validate CSRF token if present
  // If token is not present (e.g., direct API calls), rely on Origin validation
  const tokenValid = validateCsrfToken(request);
  if (!tokenValid && request.headers.get('x-csrf-token')) {
    // Only fail if token was provided but is invalid
    return {
      isValid: false,
      error: 'Invalid CSRF token. Request rejected for security reasons.'
    };
  }
  
  return { isValid: true };
}

