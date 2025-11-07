'use client';

import { createClient } from '@/lib/supabase-client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

/**
 * Client-side callback page for handling OAuth redirects
 * This handles the case where server-side cookie setting might not work
 */
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient();
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');
      const isVSCodeRedirect = searchParams.get('vscode') === 'true' || searchParams.get('redirect') === 'vscode';
      
      // Check if this is a VS Code auth flow (from email verification or OAuth)
      const isVSCodeAuth = isVSCodeRedirect || localStorage.getItem('vscode_auth_pending') === 'true';
      
      // Handle errors in URL (e.g., expired email verification link)
      if (error) {
        const errorMessage = errorDescription || error;
        if (isVSCodeAuth) {
          // Redirect to VS Code with error
          localStorage.removeItem('vscode_auth_pending');
          window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?error=${encodeURIComponent(errorMessage)}`;
          return;
        } else {
          router.push(`/?error=${encodeURIComponent(errorMessage)}`);
          return;
        }
      }
      
      // Check if this is a VS Code redirect request
      if (isVSCodeRedirect) {
        // For VS Code redirect, we need to handle both code flow and token flow
        
        if (code) {
          // OAuth code flow: exchange code for session
          // The PKCE code verifier should be in sessionStorage from OAuth initiation
          // CRITICAL: Create a fresh Supabase client to ensure proper sessionStorage access
          const supabaseClient = createClient();
          
          // Check if this is a VS Code OAuth flow (redirected from /auth/vscode)
          const vscodeRedirect = localStorage.getItem('vscode_oauth_redirect');
          const isVSCodeOAuthFlow = vscodeRedirect && vscodeRedirect.includes('/auth/vscode');
          
          // Check if code verifier exists in sessionStorage (for debugging)
          if (typeof window !== 'undefined' && window.sessionStorage) {
            const storageKeys = Object.keys(window.sessionStorage);
            console.log('SessionStorage keys on callback:', storageKeys);
            
            // Look for Supabase auth storage keys
            const supabaseKeys = storageKeys.filter(key => 
              key.includes('supabase') || key.includes('auth') || key.includes('code')
            );
            console.log('Supabase-related keys:', supabaseKeys);
            
            // Check for code verifier specifically
            let codeVerifierKey = storageKeys.find(key => 
              key.includes('code-verifier') || key.includes('code_verifier') || key.includes('pkce')
            );
            
            // Also check for backup code verifier
            if (!codeVerifierKey) {
              const backupKey = storageKeys.find(key => key === 'supabase-auth-code-verifier-backup');
              if (backupKey) {
                console.log('Found backup code verifier key:', backupKey);
                codeVerifierKey = backupKey;
              }
            }
            
            if (!codeVerifierKey) {
              console.error('PKCE code verifier not found in sessionStorage!');
              console.error('Available keys:', storageKeys);
              
              // If this is a VS Code flow and code verifier is missing, redirect to /auth/vscode
              // where the code verifier should be accessible
              if (isVSCodeOAuthFlow) {
                console.log('Redirecting to /auth/vscode to access code verifier');
                window.location.href = `${window.location.origin}/auth/vscode?code=${code}`;
                return;
              }
            } else {
              console.log('Found code verifier key:', codeVerifierKey);
            }
          }
          
          const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code);
          
          if (error) {
            // Check if it's a PKCE error
            const errorMessage = error.message || 'Authentication failed';
            if (errorMessage.includes('code verifier') || errorMessage.includes('PKCE') || errorMessage.includes('code_verifier')) {
              // PKCE error - redirect to VS Code with a helpful error message
              // Clear any stale sessionStorage entries
              if (typeof window !== 'undefined' && window.sessionStorage) {
                try {
                  const storageKeys = Object.keys(window.sessionStorage);
                  storageKeys.forEach(key => {
                    if (key.includes('supabase.auth') || key.includes('code-verifier')) {
                      window.sessionStorage.removeItem(key);
                    }
                  });
                } catch (e) {
                  console.error('Error clearing sessionStorage:', e);
                }
              }
              localStorage.removeItem('vscode_auth_pending');
              window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?error=${encodeURIComponent('PKCE verification failed. Please try signing in again.')}`;
            } else {
              // Other error
              localStorage.removeItem('vscode_auth_pending');
              window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?error=${encodeURIComponent(errorMessage)}`;
            }
            return;
          }
          
          if (data?.session) {
            // Extract tokens from session and redirect to VS Code
            localStorage.removeItem('vscode_auth_pending');
            localStorage.removeItem('vscode_oauth_redirect');
            const params = new URLSearchParams({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token || '',
              expires_at: data.session.expires_at?.toString() || '',
              expires_in: data.session.expires_in?.toString() || '3600',
              token_type: data.session.token_type || 'bearer',
            });
            
            window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?${params.toString()}`;
            return;
          }
        } else {
          // Magic link flow: tokens are in the hash fragment
          // Extract tokens from hash and redirect to VS Code
          const hash = window.location.hash.substring(1); // Remove #
          if (hash) {
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            const expiresAt = params.get('expires_at');
            const expiresIn = params.get('expires_in');
            const tokenType = params.get('token_type');
            const error = params.get('error');
            const errorDescription = params.get('error_description');
            
            if (error) {
              // Redirect to VS Code with error
              window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?error=${encodeURIComponent(errorDescription || error)}`;
              return;
            }
            
            if (accessToken) {
              // Build VS Code redirect URL with tokens
              localStorage.removeItem('vscode_auth_pending');
              const vscodeParams = new URLSearchParams();
              vscodeParams.set('access_token', accessToken);
              if (refreshToken) vscodeParams.set('refresh_token', refreshToken);
              if (expiresAt) vscodeParams.set('expires_at', expiresAt);
              if (expiresIn) vscodeParams.set('expires_in', expiresIn);
              if (tokenType) vscodeParams.set('token_type', tokenType);
              
              window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?${vscodeParams.toString()}`;
              return;
            }
          }
        }
        
        // Fallback: redirect to VS Code with error if no tokens found
        localStorage.removeItem('vscode_auth_pending');
        window.location.href = 'vscode://JohnStilia.pasteportal/auth-callback?error=No authentication tokens found';
        return;
      }

      // Check if we're on the /auth/vscode page (should redirect there instead)
      // This handles the case where magic link redirects to callback but we want VS Code flow
      const isVSCodePage = window.location.pathname.includes('/auth/vscode');
      
      // If this is a callback from VS Code magic link flow, check hash for tokens or errors
      const hash = window.location.hash.substring(1);
      if (hash && !code) {
        // Magic link with tokens or errors in hash - check if this is from VS Code flow
        const hashParams = new URLSearchParams(hash);
        const hashError = hashParams.get('error');
        const hashErrorDescription = hashParams.get('error_description');
        const accessToken = hashParams.get('access_token');
        
        // Check for errors in hash first
        if (hashError) {
          const errorMessage = hashErrorDescription || hashError;
          if (isVSCodeAuth) {
            localStorage.removeItem('vscode_auth_pending');
            window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?error=${encodeURIComponent(errorMessage)}`;
            return;
          } else {
            router.push(`/?error=${encodeURIComponent(errorMessage)}`);
            return;
          }
        }
        
        if (accessToken) {
          // Redirect to VS Code with tokens
          const vscodeParams = new URLSearchParams();
          vscodeParams.set('access_token', accessToken);
          const refreshToken = hashParams.get('refresh_token');
          const expiresAt = hashParams.get('expires_at');
          const expiresIn = hashParams.get('expires_in');
          const tokenType = hashParams.get('token_type');
          
          if (refreshToken) vscodeParams.set('refresh_token', refreshToken);
          if (expiresAt) vscodeParams.set('expires_at', expiresAt);
          if (expiresIn) vscodeParams.set('expires_in', expiresIn);
          if (tokenType) vscodeParams.set('token_type', tokenType);
          
          window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?${vscodeParams.toString()}`;
          return;
        }
      }

      // Normal web flow or VS Code email verification callback
      if (code) {
        // Exchange code for session
        // The PKCE code verifier should be in sessionStorage from OAuth initiation
        // CRITICAL: Create a fresh Supabase client to ensure proper sessionStorage access
        const supabaseClient = createClient();
        
        // Check if code verifier exists in sessionStorage (for debugging)
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const storageKeys = Object.keys(window.sessionStorage);
          const codeVerifierKey = storageKeys.find(key => 
            key.includes('code-verifier') || key.includes('supabase.auth')
          );
          if (!codeVerifierKey && process.env.NODE_ENV === 'development') {
            console.warn('PKCE code verifier not found in sessionStorage. This may cause authentication to fail.');
          }
        }
        
        const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code);

        if (error) {
          const errorMessage = error.message || 'Authentication failed';
          // Check if it's a PKCE error
          if (errorMessage.includes('code verifier') || errorMessage.includes('PKCE') || errorMessage.includes('code_verifier')) {
            // Clear any stale sessionStorage entries
            if (typeof window !== 'undefined' && window.sessionStorage) {
              try {
                const storageKeys = Object.keys(window.sessionStorage);
                storageKeys.forEach(key => {
                  if (key.includes('supabase.auth') || key.includes('code-verifier')) {
                    window.sessionStorage.removeItem(key);
                  }
                });
              } catch (e) {
                console.error('Error clearing sessionStorage:', e);
              }
            }
            if (isVSCodeAuth) {
              // PKCE error - redirect to VS Code with a helpful error message
              localStorage.removeItem('vscode_auth_pending');
              window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?error=${encodeURIComponent('PKCE verification failed. Please try signing in again.')}`;
            } else {
              router.push(`/?error=${encodeURIComponent('PKCE verification failed. Please try signing in again.')}`);
            }
          } else {
            if (isVSCodeAuth) {
              // Redirect to VS Code with error
              localStorage.removeItem('vscode_auth_pending');
              window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?error=${encodeURIComponent(errorMessage)}`;
            } else {
              router.push(`/?error=${encodeURIComponent(errorMessage)}`);
            }
          }
          return;
        }

        // Check if this is a VS Code auth flow (email verification from VS Code signup)
        if (isVSCodeAuth && data?.session) {
          // Redirect to VS Code with session tokens
          localStorage.removeItem('vscode_auth_pending');
          const params = new URLSearchParams({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token || '',
            expires_at: data.session.expires_at?.toString() || '',
            expires_in: data.session.expires_in?.toString() || '3600',
            token_type: data.session.token_type || 'bearer',
          });
          window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?${params.toString()}`;
          return;
        }

        // Check if this is a new signup and user accepted terms/privacy
        if (data?.user) {
          const pendingTermsAccepted = localStorage.getItem('pending_terms_accepted');
          const pendingPrivacyAccepted = localStorage.getItem('pending_privacy_accepted');
          const termsAcceptedAt = localStorage.getItem('pending_terms_accepted_at');
          const privacyAcceptedAt = localStorage.getItem('pending_privacy_accepted_at');

          // If user accepted terms/privacy before OAuth, update metadata
          if (pendingTermsAccepted === 'true' && pendingPrivacyAccepted === 'true') {
            // Check if user metadata doesn't already have acceptance (new signup)
            const userMetadata = data.user.user_metadata;
            if (!userMetadata?.terms_accepted || !userMetadata?.privacy_accepted) {
              await supabase.auth.updateUser({
                data: {
                  ...userMetadata,
                  terms_accepted: true,
                  privacy_accepted: true,
                  terms_accepted_at: termsAcceptedAt || new Date().toISOString(),
                  privacy_accepted_at: privacyAcceptedAt || new Date().toISOString(),
                },
              });
            }
            
            // Clear localStorage
            localStorage.removeItem('pending_terms_accepted');
            localStorage.removeItem('pending_privacy_accepted');
            localStorage.removeItem('pending_terms_accepted_at');
            localStorage.removeItem('pending_privacy_accepted_at');
          }
        }

        router.push('/');
      } else {
        // No code - check if we have a session and VS Code auth pending
        if (isVSCodeAuth) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            localStorage.removeItem('vscode_auth_pending');
            const params = new URLSearchParams({
              access_token: session.access_token,
              refresh_token: session.refresh_token || '',
              expires_at: session.expires_at?.toString() || '',
              expires_in: session.expires_in?.toString() || '3600',
              token_type: session.token_type || 'bearer',
            });
            window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?${params.toString()}`;
            return;
          }
        }
        router.push('/');
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-positive-highlight mx-auto mb-4"></div>
        <p className="text-text-secondary">Completing authentication...</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-positive-highlight mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
