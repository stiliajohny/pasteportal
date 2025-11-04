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
  const method = request.method;
  
  // For state-changing methods (POST, PUT, DELETE, PATCH), require origin validation
  const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  
  // Allow GET/OPTIONS/HEAD without origin (safe methods)
  if (!isStateChanging && !origin) {
    return true;
  }
  
  // For state-changing methods, require origin header in production
  if (isStateChanging && !origin) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // In development, allow same-origin requests without origin header
    if (isDevelopment && host) {
      // Check if it's a localhost request
      if (
        host.includes('localhost') ||
        host.includes('127.0.0.1') ||
        host.includes('[::1]')
      ) {
        return true;
      }
    }
    
    // In production, require origin header for state-changing methods
    // Direct API calls (VS Code extension) will be detected as non-browser
    // and handled separately in validateCsrfToken
    if (!isDevelopment) {
      return false;
    }
    
    // Development: allow if host exists (same-origin request)
    return !!host;
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
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : host ? [`https://${host}`, `http://${host}`] : [];
  
  // Validate against allowed origins
  try {
    const originUrl = new URL(origin);
    
    // Validate origin URL format
    if (!originUrl.protocol || !originUrl.hostname) {
      return false;
    }
    
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(originUrl.protocol)) {
      return false;
    }
    
    const isValidOrigin = allowedOrigins.some(allowed => {
      try {
        const allowedUrl = new URL(allowed);
        
        // Compare protocol
        if (originUrl.protocol !== allowedUrl.protocol) {
          return false;
        }
        
        // Compare hostname (case-insensitive)
        if (originUrl.hostname.toLowerCase() !== allowedUrl.hostname.toLowerCase()) {
          // Check for subdomain matching (e.g., app.example.com matches example.com if allowed)
          // This is a security consideration - adjust based on your needs
          // For now, exact match only
          return false;
        }
        
        // Compare ports (default ports: 80 for http, 443 for https)
        const originPort = originUrl.port || (originUrl.protocol === 'https:' ? '443' : '80');
        const allowedPort = allowedUrl.port || (allowedUrl.protocol === 'https:' ? '443' : '80');
        
        return originPort === allowedPort;
      } catch {
        // If allowed origin is not a full URL, compare hostnames
        return originUrl.hostname.toLowerCase() === allowed.toLowerCase() || 
               originUrl.host.toLowerCase() === allowed.toLowerCase();
      }
    });
    
    if (isValidOrigin) {
      return true;
    }
  } catch {
    // Invalid origin URL format
    return false;
  }
  
  // Fallback: validate referer if origin validation failed
  // Note: Referer can be spoofed, so this is less reliable than Origin
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      
      // Validate referer URL format
      if (!refererUrl.protocol || !refererUrl.hostname) {
        return false;
      }
      
      // Only allow http/https protocols
      if (!['http:', 'https:'].includes(refererUrl.protocol)) {
        return false;
      }
      
      const isDevelopment = process.env.NODE_ENV === 'development';
      
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
          
          // Compare protocol
          if (refererUrl.protocol !== allowedUrl.protocol) {
            return false;
          }
          
          // Compare hostname (case-insensitive)
          if (refererUrl.hostname.toLowerCase() !== allowedUrl.hostname.toLowerCase()) {
            return false;
          }
          
          // Compare ports
          const refererPort = refererUrl.port || (refererUrl.protocol === 'https:' ? '443' : '80');
          const allowedPort = allowedUrl.port || (allowedUrl.protocol === 'https:' ? '443' : '80');
          
          return refererPort === allowedPort;
        } catch {
          return refererUrl.hostname.toLowerCase() === allowed.toLowerCase() || 
                 refererUrl.host.toLowerCase() === allowed.toLowerCase();
        }
      });
    } catch {
      // Invalid referer URL format
      return false;
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
  const cookieToken = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
  
  // If token is not required (e.g., public endpoints), allow
  if (!requireToken) {
    return { isValid: true };
  }
  
  // Validate token format if provided (64 hex characters)
  const tokenFormatRegex = /^[a-f0-9]{64}$/i;
  if (csrfToken && !tokenFormatRegex.test(csrfToken)) {
    return {
      isValid: false,
      reason: 'Invalid CSRF token format'
    };
  }
  
  if (cookieToken && !tokenFormatRegex.test(cookieToken)) {
    return {
      isValid: false,
      reason: 'Invalid CSRF token format in cookie'
    };
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
  const method = request.method;
  const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  
  if (isBrowser) {
    // For browser requests with state-changing methods, require CSRF token
    if (isStateChanging) {
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
    
    // For safe methods (GET, OPTIONS, HEAD), allow without token
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
  // This maintains backward compatibility with VS Code extension
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

