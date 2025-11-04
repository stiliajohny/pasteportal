import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Maximum allowed request size (in bytes)
 * This is a safety limit to prevent DoS via large requests
 * 1MB should be sufficient for most API requests (paste content is limited separately)
 */
const MAX_REQUEST_SIZE = 1024 * 1024; // 1MB

/**
 * Generate a random hex string using Web Crypto API (Edge Runtime compatible)
 * @param length - Number of bytes to generate (default: 32)
 * @returns Hex string representation (2x length characters)
 */
function generateRandomHex(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

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
    'autoplay=()',
    'camera=()',
    'cross-origin-isolated=()',
    'display-capture=()',
    'encrypted-media=()',
    'fullscreen=(self)',
    'geolocation=()',
    'gyroscope=()',
    'keyboard-map=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
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
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://supabase.com https://www.googletagmanager.com https://*.googletagmanager.com https://pagead2.googlesyndication.com https://*.googlesyndication.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://avatars.githubusercontent.com https://*.supabase.co https://storage.ko-fi.com https://ko-fi.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://icanhazdadjoke.com https://fonts.googleapis.com https://fonts.gstatic.com https://ko-fi.com https://storage.ko-fi.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com",
    "frame-src 'self' https://*.supabase.co https://*.googlesyndication.com https://googleads.g.doubleclick.net",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  // Generate CSRF token for browser requests to HTML pages
  // Only set for HTML pages (not API routes or static assets)
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith('/api');
  const isStaticAsset = /\.(jpg|jpeg|png|gif|svg|ico|css|js|woff|woff2|ttf|eot|map|json)$/i.test(pathname);
  const isNextInternal = pathname.startsWith('/_next');
  
  // Only generate tokens for HTML pages (browser requests)
  if (!isApiRoute && !isStaticAsset && !isNextInternal) {
    const cookies = request.cookies;
    const hasCsrfToken = cookies.has('csrf-token');
    
    // Generate new token if one doesn't exist
    if (!hasCsrfToken) {
      // Generate 64-character hex token (32 bytes)
      const token = generateRandomHex(32);
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Set CSRF token cookie
      // Note: Not HttpOnly so JavaScript can read it for X-CSRF-Token header
      // Security: SameSite=Strict and Secure flags prevent CSRF attacks
      response.cookies.set('csrf-token', token, {
        httpOnly: false, // Allow JavaScript access for double-submit pattern
        secure: isProduction, // HTTPS only in production
        sameSite: 'strict', // CSRF protection
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      });
    }
  }

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

