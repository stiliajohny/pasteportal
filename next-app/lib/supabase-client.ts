import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Client-side Supabase client for authentication
 * Must be used in client components only
 * 
 * Note: We use the standard Supabase client (not SSR client) for proper PKCE support.
 * The code verifier is stored in sessionStorage when OAuth is initiated
 * and retrieved when exchanging the code. The standard client properly handles
 * PKCE flows with sessionStorage.
 * 
 * IMPORTANT: We use a singleton pattern to ensure the same client instance is used
 * throughout the OAuth flow. This ensures the PKCE code verifier stored in sessionStorage
 * is accessible when exchanging the code for a session.
 */
export function createClient(): SupabaseClient {
  // Use singleton pattern to ensure consistent client instance
  // This is critical for PKCE flows where the code verifier must be accessible
  // from the same sessionStorage context
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  // Validate URL format
  try {
    new URL(supabaseUrl);
  } catch {
    throw new Error(`Invalid Supabase URL: ${supabaseUrl}`);
  }

  // Use the standard Supabase client for client-side OAuth flows
  // This properly handles PKCE with sessionStorage
  // The SSR client (createBrowserClient) is designed for server-side rendering
  // and uses cookies, which can cause PKCE issues
  supabaseClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Use sessionStorage for PKCE code verifier (default behavior)
      // CRITICAL: This must be sessionStorage (not localStorage) for PKCE to work
      // Supabase stores the PKCE code verifier in sessionStorage with a key based on the project URL
      storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
      // Enable PKCE flow (default for OAuth, but explicit for clarity)
      flowType: 'pkce',
      // Auto-refresh tokens
      autoRefreshToken: true,
      // Persist session
      persistSession: true,
    },
  });

  return supabaseClient;
}
