import { NextRequest } from 'next/server';

/**
 * Get allowed origins from environment variable
 * @returns Array of allowed origin URLs
 */
function getAllowedOrigins(): string[] {
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  
  if (!allowedOriginsEnv) {
    // Default to empty array - same-origin only
    return [];
  }
  
  // Split by comma and trim whitespace
  return allowedOriginsEnv
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
}

/**
 * Check if an origin is allowed
 * @param origin - Origin URL to check
 * @param allowedOrigins - Array of allowed origin URLs
 * @returns True if origin is allowed
 */
function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
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
  
  if (allowedOrigins.length === 0) {
    return false;
  }
  
  try {
    const originUrl = new URL(origin);
    
    return allowedOrigins.some(allowed => {
      try {
        const allowedUrl = new URL(allowed);
        return (
          originUrl.protocol === allowedUrl.protocol &&
          originUrl.hostname === allowedUrl.hostname &&
          (originUrl.port === allowedUrl.port || (!originUrl.port && !allowedUrl.port))
        );
      } catch {
        // If allowed origin is not a full URL, compare hostnames
        return originUrl.hostname === allowed || originUrl.host === allowed;
      }
    });
  } catch {
    // Invalid origin URL format
    return false;
  }
}

/**
 * Get CORS headers for a request
 * Validates origin against whitelist and returns appropriate CORS headers
 * @param request - NextRequest object
 * @param methods - Allowed HTTP methods (default: GET, POST, OPTIONS)
 * @param headers - Allowed headers (default: Content-Type)
 * @returns Object with CORS headers
 */
export function getCorsHeaders(
  request: NextRequest,
  methods: string = 'GET, POST, OPTIONS',
  headers: string = 'Content-Type'
): Record<string, string> {
  const origin = request.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();
  
  // If no origin header, it's a same-origin request - no CORS headers needed
  // For same-origin requests, browser handles CORS automatically
  if (!origin) {
    return {};
  }
  
  // Check if origin is allowed
  if (isOriginAllowed(origin, allowedOrigins)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': headers,
      'Access-Control-Allow-Credentials': 'true',
    };
  }
  
  // Origin not allowed - return empty headers (will be rejected by browser)
  // Or return same-origin only (more restrictive)
  return {};
}

/**
 * Create a CORS-enabled OPTIONS response
 * @param request - NextRequest object
 * @param methods - Allowed HTTP methods (default: GET, POST, OPTIONS)
 * @param headers - Allowed headers (default: Content-Type)
 * @returns Response object for OPTIONS request
 */
export function corsOptionsResponse(
  request: NextRequest,
  methods: string = 'GET, POST, OPTIONS',
  headers: string = 'Content-Type'
): Response {
  const corsHeaders = getCorsHeaders(request, methods, headers);
  
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

