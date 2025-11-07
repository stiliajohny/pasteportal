import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Custom storage adapter that ensures PKCE code verifier is accessible
 * across different redirect URLs (e.g., /auth/vscode and /auth/callback)
 */
function createPKCESafeStorage() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const baseStorage = window.sessionStorage;

  return {
    getItem: (key: string): string | null => {
      const value = baseStorage.getItem(key);
      
      // If this is a code verifier lookup and value is null, try alternative keys
      if (!value && key.includes('code_verifier')) {
        // Try to find code verifier stored with different redirect URL
        const allKeys = Object.keys(baseStorage);
        const codeVerifierKey = allKeys.find(k => 
          k.includes('code_verifier') || k.includes('code-verifier') || k.includes('pkce')
        );
        
        if (codeVerifierKey) {
          console.log(`Found code verifier with alternative key: ${codeVerifierKey}`);
          return baseStorage.getItem(codeVerifierKey);
        }
      }
      
      return value;
    },
    setItem: (key: string, value: string): void => {
      baseStorage.setItem(key, value);
      
      // If storing code verifier, also store a backup with a generic key
      if (key.includes('code_verifier') || key.includes('code-verifier')) {
        const backupKey = `supabase-auth-code-verifier-backup`;
        baseStorage.setItem(backupKey, value);
        console.log(`Stored code verifier backup with key: ${backupKey}`);
      }
    },
    removeItem: (key: string): void => {
      baseStorage.removeItem(key);
      
      // Also remove backup if removing code verifier
      if (key.includes('code_verifier') || key.includes('code-verifier')) {
        baseStorage.removeItem('supabase-auth-code-verifier-backup');
      }
    },
  };
}

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
      // Use custom storage adapter that handles PKCE code verifier across redirect URLs
      // CRITICAL: This must be sessionStorage (not localStorage) for PKCE to work
      // Supabase stores the PKCE code verifier in sessionStorage with a key based on the project URL
      storage: createPKCESafeStorage(),
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
