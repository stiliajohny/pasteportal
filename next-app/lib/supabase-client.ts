import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Custom storage adapter that ensures PKCE code verifier is accessible
 * across different redirect URLs (e.g., /auth/vscode and /auth/callback)
 * 
 * This adapter normalizes storage keys to ensure the code verifier is accessible
 * regardless of which redirect URL Supabase uses.
 */
function createPKCESafeStorage() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const baseStorage = window.sessionStorage;
  
  // Fixed storage key for code verifier - ignores redirect URL
  const FIXED_CODE_VERIFIER_KEY = 'supabase-pkce-code-verifier';

  return {
    getItem: (key: string): string | null => {
      // For code verifier, always use the fixed key
      if (key.includes('code_verifier') || key.includes('code-verifier')) {
        console.log(`[PKCE Storage] Reading code verifier from fixed key: ${FIXED_CODE_VERIFIER_KEY}`);
        const value = baseStorage.getItem(FIXED_CODE_VERIFIER_KEY);
        
        if (!value) {
          // Fallback: try to find any code verifier in storage
          const allKeys = Object.keys(baseStorage);
          console.log(`[PKCE Storage] Code verifier not found in fixed key. Searching all keys:`, allKeys);
          
          const codeVerifierKey = allKeys.find(k => 
            k.includes('code_verifier') || k.includes('code-verifier') || k.includes('pkce')
          );
          
          if (codeVerifierKey) {
            console.log(`[PKCE Storage] Found code verifier with key: ${codeVerifierKey}`);
            return baseStorage.getItem(codeVerifierKey);
          }
          
          console.error('[PKCE Storage] Code verifier not found in any storage key!');
          return null;
        }
        
        console.log(`[PKCE Storage] Code verifier found in fixed key`);
        return value;
      }
      
      // For other keys, use default behavior
      return baseStorage.getItem(key);
    },
    
    setItem: (key: string, value: string): void => {
      // Store in the original key for compatibility
      baseStorage.setItem(key, value);
      
      // For code verifier, ALSO store in fixed key
      if (key.includes('code_verifier') || key.includes('code-verifier')) {
        console.log(`[PKCE Storage] Storing code verifier in fixed key: ${FIXED_CODE_VERIFIER_KEY}`);
        console.log(`[PKCE Storage] Original key was: ${key}`);
        baseStorage.setItem(FIXED_CODE_VERIFIER_KEY, value);
        
        // Also store in localStorage as ultimate fallback
        try {
          window.localStorage.setItem(FIXED_CODE_VERIFIER_KEY, value);
          console.log(`[PKCE Storage] Also stored code verifier in localStorage as fallback`);
        } catch (e) {
          console.error('[PKCE Storage] Failed to store in localStorage:', e);
        }
      }
    },
    
    removeItem: (key: string): void => {
      baseStorage.removeItem(key);
      
      // Also remove from fixed key and localStorage
      if (key.includes('code_verifier') || key.includes('code-verifier')) {
        console.log(`[PKCE Storage] Removing code verifier from fixed key: ${FIXED_CODE_VERIFIER_KEY}`);
        baseStorage.removeItem(FIXED_CODE_VERIFIER_KEY);
        try {
          window.localStorage.removeItem(FIXED_CODE_VERIFIER_KEY);
        } catch (e) {
          console.error('[PKCE Storage] Failed to remove from localStorage:', e);
        }
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
