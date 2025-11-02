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
  
  // In development, allow localhost origins
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (isDevelopment) {
    try {
      const originUrl = new URL(origin);
      // Allow localhost, 127.0.0.1, and ::1 (IPv6 localhost) on any port
      if (
        originUrl.hostname === 'localhost' ||
        originUrl.hostname === '127.0.0.1' ||
        originUrl.hostname === '::1'
      ) {
        return true;
      }
    } catch {
      // Invalid origin URL format, continue to normal validation
    }
  }
  
  // Get allowed origins from environment or use host as fallback
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : host ? [`https://${host}`, `http://${host}`] : [];
  
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
      
      // In development, allow localhost referers
      if (isDevelopment) {
        if (
          refererUrl.hostname === 'localhost' ||
          refererUrl.hostname === '127.0.0.1' ||
          refererUrl.hostname === '::1'
        ) {
          return true;
        }
      }
      
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
 * Check if request appears to be from a browser (vs direct API call)
 * @param request - NextRequest object
 * @returns True if request appears to be from a browser
 */
function isBrowserRequest(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') || '';
  const cookies = request.headers.get('cookie') || '';
  
  // Check for browser user agent patterns
  const browserPatterns = /Mozilla|Chrome|Safari|Firefox|Edge|Opera|iPhone|iPad|Android/i;
  const hasBrowserUA = browserPatterns.test(userAgent);
  
  // If there are cookies (especially session cookies), likely a browser
  const hasCookies = cookies.length > 0;
  
  // Consider it a browser request if it has browser UA or cookies
  // Direct API calls typically don't have browser UA or session cookies
  return hasBrowserUA || hasCookies;
}

/**
 * Validate CSRF token for authenticated requests
 * Uses double-submit cookie pattern
 * For browser requests, requires both token header and cookie
 * For direct API calls, relies on origin validation only
 * @param request - NextRequest object
 * @param requireToken - Whether to require token (default: true for authenticated requests)
 * @returns Object with isValid flag and reason
 */
export function validateCsrfToken(
  request: NextRequest,
  requireToken: boolean = true
): { isValid: boolean; reason?: string } {
  // Get CSRF token from header (client should send X-CSRF-Token header)
  const csrfToken = request.headers.get('x-csrf-token');
  
  // Get CSRF token from cookie (set on page load)
  const cookies = request.headers.get('cookie') || '';
  const cookieMatch = cookies.match(/csrf-token=([^;]+)/);
  const cookieToken = cookieMatch ? cookieMatch[1] : null;
  
  // If token is not required (e.g., public endpoints), allow
  if (!requireToken) {
    return { isValid: true };
  }
  
  // In development, allow localhost requests without CSRF token
  // Origin validation already ensures the request is from localhost
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (isDevelopment) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    
    // Check origin header
    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (
          originUrl.hostname === 'localhost' ||
          originUrl.hostname === '127.0.0.1' ||
          originUrl.hostname === '::1'
        ) {
          // Localhost in development - skip CSRF token requirement
          // Origin validation already provides protection
          return { isValid: true };
        }
      } catch {
        // Invalid origin URL format, continue to normal validation
      }
    }
    
    // Check host header for same-origin requests (no origin header)
    if (!origin && host) {
      if (
        host.includes('localhost') ||
        host.includes('127.0.0.1') ||
        host.includes('[::1]')
      ) {
        // Same-origin localhost request in development
        return { isValid: true };
      }
    }
  }
  
  // For browser requests, require CSRF token
  // For direct API calls (no browser indicators), we rely on origin validation
  const isBrowser = isBrowserRequest(request);
  
  if (isBrowser) {
    // Browser requests must provide both header and cookie tokens
    if (!csrfToken || !cookieToken) {
      return {
        isValid: false,
        reason: 'CSRF token required for browser requests'
      };
    }
    
    // Validate that header token matches cookie token (double-submit pattern)
    if (csrfToken !== cookieToken) {
      return {
        isValid: false,
        reason: 'CSRF token mismatch'
      };
    }
    
    return { isValid: true };
  }
  
  // For direct API calls (VS Code extension, etc.), allow if origin is valid
  // Origin validation will be checked separately
  // If token is provided, validate it, but don't require it
  if (csrfToken && cookieToken) {
    if (csrfToken !== cookieToken) {
      return {
        isValid: false,
        reason: 'CSRF token mismatch'
      };
    }
  }
  
  // Allow direct API calls without token (origin validation will catch CSRF)
  return { isValid: true };
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
  
  // Validate Origin/Referer headers first
  const originValid = validateOrigin(request);
  if (!originValid) {
    return {
      isValid: false,
      error: 'Invalid origin. Request rejected for security reasons.'
    };
  }
  
  // For authenticated requests, validate CSRF token
  // Browser requests require tokens, direct API calls rely on origin validation
  const tokenValidation = validateCsrfToken(request, requireAuth);
  if (!tokenValidation.isValid) {
    return {
      isValid: false,
      error: tokenValidation.reason || 'Invalid CSRF token. Request rejected for security reasons.'
    };
  }
  
  return { isValid: true };
}

