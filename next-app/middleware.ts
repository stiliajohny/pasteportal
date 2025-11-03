import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Maximum allowed request size (in bytes)
 * This is a safety limit to prevent DoS via large requests
 * 1MB should be sufficient for most API requests (paste content is limited separately)
 */
const MAX_REQUEST_SIZE = 1024 * 1024; // 1MB

/**
 * Check if request size exceeds limits
 * @param request - NextRequest object
 * @returns True if request size is acceptable
 */
async function checkRequestSize(request: NextRequest): Promise<boolean> {
  const contentLength = request.headers.get('content-length');
  
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > MAX_REQUEST_SIZE) {
      return false;
    }
  }
  
  // For requests without Content-Length header, we can't pre-check
  // The actual body parsing in API routes should handle this
  return true;
}

/**
 * Middleware to add security headers to all responses
 * Ensures security headers are applied in all environments (dev, prod, etc.)
 * Not just in Netlify configuration
 */
export async function middleware(request: NextRequest) {
  // HTTPS redirect enforcement in production
  if (process.env.NODE_ENV === 'production') {
    const url = request.nextUrl;
    const hostname = request.headers.get('host') || url.hostname;
    
    // Check if request is HTTP (not HTTPS) and not localhost
    if (
      url.protocol === 'http:' &&
      !hostname.includes('localhost') &&
      !hostname.includes('127.0.0.1')
    ) {
      // Redirect to HTTPS
      url.protocol = 'https:';
      return NextResponse.redirect(url);
    }
  }
  
  // Check request size for POST/PUT/PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const sizeOk = await checkRequestSize(request);
    if (!sizeOk) {
      return NextResponse.json(
        {
          error: 'Request entity too large',
          message: `Request body exceeds maximum size of ${MAX_REQUEST_SIZE} bytes`,
        },
        { status: 413 }
      );
    }
  }
  
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions-Policy: Restrict browser features to prevent abuse
  const permissionsPolicy = [
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=()',
    'battery=()',
    'camera=()',
    'cross-origin-isolated=()',
    'display-capture=()',
    'document-domain=()',
    'encrypted-media=()',
    'execution-while-not-rendered=()',
    'execution-while-out-of-viewport=()',
    'fullscreen=(self)',
    'geolocation=()',
    'gyroscope=()',
    'keyboard-map=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'navigation-override=()',
    'payment=()',
    'picture-in-picture=()',
    'publickey-credentials-get=(self)',
    'screen-wake-lock=()',
    'sync-xhr=()',
    'usb=()',
    'web-share=()',
    'xr-spatial-tracking=()',
  ].join(', ');
  response.headers.set('Permissions-Policy', permissionsPolicy);

  // Strict-Transport-Security (HSTS): Forces browsers to use HTTPS only
  // Only set in production to avoid issues in local development
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Content-Security-Policy: Strict CSP to prevent XSS and injection attacks
  // Note: 'unsafe-inline' and 'unsafe-eval' are required for Next.js to function
  // but we restrict other directives as much as possible
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://supabase.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://avatars.githubusercontent.com https://*.supabase.co https://storage.ko-fi.com https://ko-fi.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://icanhazdadjoke.com https://fonts.googleapis.com https://fonts.gstatic.com https://ko-fi.com https://storage.ko-fi.com",
    "frame-src 'self' https://*.supabase.co",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  return response;
}

// Apply middleware to all routes including API routes
// Security headers should be applied to all responses
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static image files
     * Note: API routes are included so they receive security headers
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

