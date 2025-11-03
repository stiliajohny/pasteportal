import { NextRequest, NextResponse } from 'next/server';

/**
 * Rate limiting configuration and implementation
 * Uses in-memory store (Map-based) for single-instance deployments
 * For production with multiple instances, consider using Redis or Upstash
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum number of requests per window
  keyGenerator?: (request: NextRequest) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// Key: identifier (IP, user ID, etc.)
// Value: { count: number, resetTime: number }
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Get client identifier for rate limiting
 * Uses IP address from headers (respects proxies)
 * @param request - NextRequest object
 * @returns Client identifier string
 */
function getClientIdentifier(request: NextRequest): string {
  // Try various headers for IP address (respects proxies like Cloudflare, Vercel, etc.)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP (client IP) from the chain
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  
  // Fallback to a default identifier if IP cannot be determined
  // In production, this should rarely happen
  return 'unknown';
}

/**
 * Default rate limit configuration for API endpoints
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
};

/**
 * More restrictive rate limit for authenticated operations
 */
const AUTHENTICATED_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 200, // 200 requests per 15 minutes (authenticated users get more)
};

/**
 * Strict rate limit for sensitive operations (login, password reset, etc.)
 */
const STRICT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 requests per 15 minutes (prevents brute force)
};

/**
 * Check if request exceeds rate limit
 * @param request - NextRequest object
 * @param config - Rate limit configuration
 * @returns Object with isAllowed flag and rate limit info
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig = DEFAULT_CONFIG
): { isAllowed: boolean; remaining: number; resetTime: number; limit: number } {
  const keyGenerator = config.keyGenerator || getClientIdentifier;
  const key = keyGenerator(request);
  const now = Date.now();
  
  // Get or create entry
  let entry = rateLimitStore.get(key);
  
  // If entry doesn't exist or window has expired, create new entry
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
  }
  
  // Increment count
  entry.count++;
  
  // Check if limit exceeded
  const isAllowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  
  return {
    isAllowed,
    remaining,
    resetTime: entry.resetTime,
    limit: config.maxRequests,
  };
}

/**
 * Create rate limit middleware for API routes
 * @param config - Rate limit configuration (optional)
 * @returns Middleware function
 */
export function createRateLimitMiddleware(config?: RateLimitConfig) {
  const rateLimitConfig = config || DEFAULT_CONFIG;
  
  return (request: NextRequest): NextResponse | null => {
    const result = checkRateLimit(request, rateLimitConfig);
    
    if (!result.isAllowed) {
      // Create rate limit error response
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
          },
        }
      );
    }
    
    // Request allowed, add rate limit headers
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
    
    return null; // null means continue with the request
  };
}

/**
 * Rate limit configurations for different endpoint types
 */
export const rateLimitConfigs = {
  default: DEFAULT_CONFIG,
  authenticated: AUTHENTICATED_CONFIG,
  strict: STRICT_CONFIG,
};

/**
 * Helper to apply rate limiting in API routes
 * @param request - NextRequest object
 * @param config - Rate limit configuration (optional)
 * @returns Error response if rate limited, null if allowed
 */
export function applyRateLimit(
  request: NextRequest,
  config?: RateLimitConfig
): NextResponse | null {
  const middleware = createRateLimitMiddleware(config);
  return middleware(request);
}
