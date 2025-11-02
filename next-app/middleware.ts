import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to add security headers to all responses
 * Ensures security headers are applied in all environments (dev, prod, etc.)
 * Not just in Netlify configuration
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

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
    "img-src 'self' data: blob: https://avatars.githubusercontent.com https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://icanhazdadjoke.com https://fonts.googleapis.com https://fonts.gstatic.com",
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

