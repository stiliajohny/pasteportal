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

  console.log('[PKCE Storage] ===== CUSTOM STORAGE ADAPTER INITIALIZED =====');

  // Use localStorage instead of sessionStorage for VS Code flows
  // sessionStorage is cleared when browser window closes, but VS Code might close the browser
  const baseStorage = window.localStorage;
  
  // Fixed storage key for code verifier - ignores redirect URL
  const FIXED_CODE_VERIFIER_KEY = 'supabase-pkce-code-verifier';

  const adapter = {
    getItem: (key: string): string | null => {
      console.log(`[PKCE Storage] ⬅️ getItem called with key: "${key}"`);
      
      // For code verifier, always use the fixed key
      if (key.includes('code_verifier') || key.includes('code-verifier')) {
        console.log(`[PKCE Storage] This is a code verifier request!`);
        console.log(`[PKCE Storage] Reading from fixed key: ${FIXED_CODE_VERIFIER_KEY}`);
        
        const value = baseStorage.getItem(FIXED_CODE_VERIFIER_KEY);
        
        if (!value) {
          // Also try sessionStorage as fallback (in case it was stored there)
          console.log(`[PKCE Storage] Not in localStorage, trying sessionStorage...`);
          try {
            const sessionValue = window.sessionStorage.getItem(FIXED_CODE_VERIFIER_KEY);
            if (sessionValue) {
              console.log(`[PKCE Storage] Code verifier found in sessionStorage!`);
              return sessionValue;
            }
          } catch (e) {
            console.error('[PKCE Storage] Failed to read from sessionStorage:', e);
          }
          
          // Fallback: try to find any code verifier in storage
          const allLocalKeys = Object.keys(baseStorage);
          const allSessionKeys = Object.keys(window.sessionStorage);
          console.log(`[PKCE Storage] Code verifier not found in fixed key. Searching all keys...`);
          console.log(`[PKCE Storage] LocalStorage keys:`, allLocalKeys);
          console.log(`[PKCE Storage] SessionStorage keys:`, allSessionKeys);
          
          // Search in both storages
          const localVerifierKey = allLocalKeys.find(k => 
            k.includes('code_verifier') || k.includes('code-verifier') || k.includes('pkce')
          );
          const sessionVerifierKey = allSessionKeys.find(k => 
            k.includes('code_verifier') || k.includes('code-verifier') || k.includes('pkce')
          );
          
          if (localVerifierKey) {
            console.log(`[PKCE Storage] Found code verifier in localStorage with key: ${localVerifierKey}`);
            return baseStorage.getItem(localVerifierKey);
          }
          
          if (sessionVerifierKey) {
            console.log(`[PKCE Storage] Found code verifier in sessionStorage with key: ${sessionVerifierKey}`);
            return window.sessionStorage.getItem(sessionVerifierKey);
          }
          
          console.error('[PKCE Storage] Code verifier not found in any storage key!');
          return null;
        }
        
        console.log(`[PKCE Storage] Code verifier found in fixed key`);
        return value;
      }
      
      // For other keys, use default behavior
      const value = baseStorage.getItem(key);
      console.log(`[PKCE Storage] ⬅️ Regular key "${key}" -> ${value ? 'found' : 'not found'}`);
      return value;
    },
    
    setItem: (key: string, value: string): void => {
      console.log(`[PKCE Storage] ➡️ setItem called with key: "${key}"`);
      console.log(`[PKCE Storage] ➡️ Value preview: ${value?.substring(0, 50)}...`);
      
      // Store in the original key for compatibility
      baseStorage.setItem(key, value);
      console.log(`[PKCE Storage] ➡️ Stored in original key: ${key}`);
      
      // For code verifier, ALSO store in fixed key
      if (key.includes('code_verifier') || key.includes('code-verifier')) {
        console.log(`[PKCE Storage] This is a code verifier! Storing in fixed key: ${FIXED_CODE_VERIFIER_KEY}`);
        console.log(`[PKCE Storage] Original key was: "${key}"`);
        console.log(`[PKCE Storage] Value length: ${value?.length || 0} characters`);
        
        baseStorage.setItem(FIXED_CODE_VERIFIER_KEY, value);
        console.log(`[PKCE Storage] ✓ Stored in localStorage fixed key`);
        
        // Also store in sessionStorage as backup
        try {
          window.sessionStorage.setItem(FIXED_CODE_VERIFIER_KEY, value);
          console.log(`[PKCE Storage] ✓ Also stored in sessionStorage as backup`);
        } catch (e) {
          console.error('[PKCE Storage] Failed to store in sessionStorage:', e);
        }
        
        // Verify it was stored
        setTimeout(() => {
          const verifyLocal = baseStorage.getItem(FIXED_CODE_VERIFIER_KEY);
          console.log(`[PKCE Storage] Verification: code verifier ${verifyLocal ? 'EXISTS' : 'MISSING'} in localStorage`);
          
          try {
            const verifySession = window.sessionStorage.getItem(FIXED_CODE_VERIFIER_KEY);
            console.log(`[PKCE Storage] Verification: code verifier ${verifySession ? 'EXISTS' : 'MISSING'} in sessionStorage`);
          } catch (e) {
            console.error('[PKCE Storage] Failed to verify sessionStorage:', e);
          }
        }, 100);
      }
    },
    
    removeItem: (key: string): void => {
      baseStorage.removeItem(key);
      
      // Also remove from fixed key and sessionStorage
      if (key.includes('code_verifier') || key.includes('code-verifier')) {
        console.log(`[PKCE Storage] Removing code verifier from fixed key: ${FIXED_CODE_VERIFIER_KEY}`);
        baseStorage.removeItem(FIXED_CODE_VERIFIER_KEY);
        try {
          window.sessionStorage.removeItem(FIXED_CODE_VERIFIER_KEY);
          console.log(`[PKCE Storage] Also removed from sessionStorage`);
        } catch (e) {
          console.error('[PKCE Storage] Failed to remove from sessionStorage:', e);
        }
      }
    },
  };
  
  console.log('[PKCE Storage] ===== STORAGE ADAPTER READY =====');
  console.log('[PKCE Storage] Adapter methods:', Object.keys(adapter));
  
  return adapter;
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

  console.log('[Supabase Client] Creating Supabase client...');
  console.log('[Supabase Client] URL:', supabaseUrl);
  console.log('[Supabase Client] Anon Key (first 20 chars):', supabaseAnonKey.substring(0, 20) + '...');
  
  const customStorage = createPKCESafeStorage();
  console.log('[Supabase Client] Custom storage created:', !!customStorage);
  
  // Use the standard Supabase client for client-side OAuth flows
  // This properly handles PKCE with sessionStorage
  // The SSR client (createBrowserClient) is designed for server-side rendering
  // and uses cookies, which can cause PKCE issues
  supabaseClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Use custom storage adapter that handles PKCE code verifier across redirect URLs
      storage: customStorage,
      // Enable PKCE flow (default for OAuth, but explicit for clarity)
      flowType: 'pkce',
      // Auto-refresh tokens
      autoRefreshToken: true,
      // Persist session
      persistSession: true,
      // Debug mode
      debug: process.env.NODE_ENV === 'development',
    },
  });

  console.log('[Supabase Client] Client created successfully');
  console.log('[Supabase Client] Auth config:', {
    flowType: 'pkce',
    hasCustomStorage: !!customStorage,
    autoRefreshToken: true,
    persistSession: true,
  });

  return supabaseClient;
}
