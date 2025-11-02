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
      const isVSCodeRedirect = searchParams.get('vscode') === 'true' || searchParams.get('redirect') === 'vscode';
      
      // Check if this is a VS Code redirect request
      if (isVSCodeRedirect) {
        // For VS Code redirect, we need to handle both code flow and token flow
        
        if (code) {
          // OAuth code flow: exchange code for session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            // Redirect to VS Code with error
            window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?error=${encodeURIComponent(error.message)}`;
            return;
          }
          
          if (data?.session) {
            // Extract tokens from session and redirect to VS Code
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
        window.location.href = 'vscode://JohnStilia.pasteportal/auth-callback?error=No authentication tokens found';
        return;
      }

      // Check if we're on the /auth/vscode page (should redirect there instead)
      // This handles the case where magic link redirects to callback but we want VS Code flow
      const isVSCodePage = window.location.pathname.includes('/auth/vscode');
      
      // If this is a callback from VS Code magic link flow, check hash for tokens
      const hash = window.location.hash.substring(1);
      if (hash && !code) {
        // Magic link with tokens in hash - check if this is from VS Code flow
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get('access_token');
        
        if (accessToken) {
          // Redirect to VS Code with tokens
          const vscodeParams = new URLSearchParams();
          vscodeParams.set('access_token', accessToken);
          const refreshToken = hashParams.get('refresh_token');
          const expiresAt = hashParams.get('expires_at');
          const expiresIn = hashParams.get('expires_in');
          const tokenType = hashParams.get('token_type');
          const error = hashParams.get('error');
          
          if (error) {
            window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?error=${encodeURIComponent(hashParams.get('error_description') || error)}`;
            return;
          }
          
          if (refreshToken) vscodeParams.set('refresh_token', refreshToken);
          if (expiresAt) vscodeParams.set('expires_at', expiresAt);
          if (expiresIn) vscodeParams.set('expires_in', expiresIn);
          if (tokenType) vscodeParams.set('token_type', tokenType);
          
          window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?${vscodeParams.toString()}`;
          return;
        }
      }

      // Normal web flow (not VS Code)
      if (code) {
        // Exchange code for session (normal web flow)
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          router.push(`/?error=${encodeURIComponent(error.message)}`);
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
