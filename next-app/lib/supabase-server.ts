import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';

/**
 * Create a server-side Supabase client for API routes
 * Uses cookies from NextRequest to maintain session
 * Follows @db.mdc rule: all database content must be encrypted
 */
export function createServerSupabaseClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

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

