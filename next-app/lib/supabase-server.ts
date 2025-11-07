import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

/**
 * Create a server-side Supabase client for API routes
 * Supports both cookie-based auth (browser) and Bearer token auth (VS Code extension, etc.)
 * Follows @db.mdc rule: all database content must be encrypted
 */
export function createServerSupabaseClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  // Check for Authorization header (Bearer token) - used by VS Code extension
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Create a client with the access token in global headers
    // This allows getUser() and other auth methods to work with the token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false, // Don't persist session in server context
        autoRefreshToken: false, // Don't auto-refresh in server context
      },
    });
    
    return supabase;
  }

  // Fall back to cookie-based auth (browser requests)
  // Create cookie handler from request
  // Parse cookies from the cookie header
  const getCookie = (name: string): string | undefined => {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, ...valueParts] = cookie.trim().split('=');
      if (key) {
        acc[key] = valueParts.join('=');
      }
      return acc;
    }, {} as Record<string, string>);
    
    return cookies[name];
  };

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: getCookie,
      set: () => {
        // For API routes, we typically don't modify cookies
        // Session is managed client-side
      },
      remove: () => {
        // For API routes, we typically don't modify cookies
      },
    },
  });
}

