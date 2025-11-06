'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import AuthDialog from '@/app/components/AuthDialog';
import { useAuth } from '@/app/contexts/AuthContext';

/**
 * VS Code Authentication Page Content
 * This component handles the authentication logic
 */
function VSCodeAuthPageContent() {
  const searchParams = useSearchParams();
  const { user, session } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(true);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [checking, setChecking] = useState(true);
  const [hasRedirected, setHasRedirected] = useState(false);
  const [hasSeenInitialAuthEvent, setHasSeenInitialAuthEvent] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);

  /**
   * Redirect to VS Code with authentication tokens
   */
  const redirectToVSCode = useCallback((session: any) => {
    if (!session || hasRedirected) return;
    
    setHasRedirected(true);
    
    // Clear the VS Code auth pending flag since we're redirecting
    localStorage.removeItem('vscode_auth_pending');

    const params = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token || '',
      expires_at: session.expires_at?.toString() || '',
      expires_in: session.expires_in?.toString() || '3600',
      token_type: session.token_type || 'bearer',
    });

    // Redirect to VS Code
    window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?${params.toString()}`;
  }, [hasRedirected]);

  useEffect(() => {
    // Mark that this is a VS Code auth session
    // This will be checked after email verification
    localStorage.setItem('vscode_auth_pending', 'true');
    
    // Only check for existing session if there's a code or hash in URL (OAuth callback)
    // Otherwise, let the user sign up/sign in fresh - DO NOT redirect on initial load
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const hash = window.location.hash.substring(1);
    
    // If there's no OAuth callback, just show the auth dialog
    // DO NOT redirect even if user has existing session - let them sign up/sign in fresh
    if (!code && !hash) {
      setChecking(false);
      return;
    }
    
    // If there's a callback (OAuth or magic link), handle it in the other useEffect
    // But still check if we already have a valid session from the callback
    if (user && session && (code || hash)) {
      // Only redirect if we have a callback AND a session
      // This means user came from OAuth and already has session
      if (!hasRedirected) {
        redirectToVSCode(session);
      }
    } else {
      setChecking(false);
    }
  }, [user, session, hasRedirected, redirectToVSCode]);

  useEffect(() => {
    // Check for mode parameter
    const mode = searchParams.get('mode');
    if (mode === 'signup') {
      setAuthMode('signup');
    }
  }, [searchParams]);

  // Listen for auth state changes (for OAuth callbacks, magic links, etc.)
  useEffect(() => {
    const supabase = createClient();
    
    // Check if this is a callback from OAuth (has code in query) or magic link (tokens in hash)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const hash = window.location.hash.substring(1);
    
    if (code) {
      // OAuth callback with code - exchange for session
      (async () => {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            // Redirect to VS Code with error
            window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?error=${encodeURIComponent(error.message)}`;
            return;
          }
          
          if (data?.session) {
            // Check if this is a new signup and user accepted terms/privacy
            if (data.user) {
              const pendingTermsAccepted = localStorage.getItem('pending_terms_accepted');
              const pendingPrivacyAccepted = localStorage.getItem('pending_privacy_accepted');
              const termsAcceptedAt = localStorage.getItem('pending_terms_accepted_at');
              const privacyAcceptedAt = localStorage.getItem('pending_privacy_accepted_at');

              if (pendingTermsAccepted === 'true' && pendingPrivacyAccepted === 'true') {
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
                
                localStorage.removeItem('pending_terms_accepted');
                localStorage.removeItem('pending_privacy_accepted');
                localStorage.removeItem('pending_terms_accepted_at');
                localStorage.removeItem('pending_privacy_accepted_at');
              }
            }
            
            if (!hasRedirected) {
              redirectToVSCode(data.session);
            }
          }
        } catch (error: any) {
          window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?error=${encodeURIComponent(error.message || 'Authentication failed')}`;
        }
      })();
    } else if (hash) {
      // Magic link callback with tokens in hash
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get('access_token');
      
      if (accessToken) {
        // Wait a bit for Supabase to process, then check session
        setTimeout(async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && !hasRedirected) {
            redirectToVSCode(session);
          }
        }, 1000);
      }
    }
    
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Only handle auth state changes after initial check is done
      if (checking) return;
      
      // CRITICAL: Ignore ALL auth events until user has interacted with the form
      // This prevents immediate redirect when page loads with existing session
      if (!userHasInteracted) {
        // Mark that we've seen the initial event
        if (!hasSeenInitialAuthEvent) {
          setHasSeenInitialAuthEvent(true);
        }
        // Don't process any events until user submits the form
        return;
      }
      
      // Only process events after user has interacted (submitted form)
      // Check if it's from OAuth callback (handled separately above)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const hash = window.location.hash.substring(1);
      if (code || hash) {
        // This is from OAuth callback, already handled above
        return;
      }
      
      // Only redirect on actual authentication events (SIGNED_IN, SIGNED_UP)
      if (event === 'SIGNED_IN') {
        if (session && session.user && !hasRedirected) {
          // User just authenticated (via email/password, etc.), redirect to VS Code
          setTimeout(() => {
            redirectToVSCode(session);
          }, 500);
        }
      } else if (event === 'SIGNED_UP') {
        if (session) {
          // User signed up and got session immediately (no email confirmation)
          if (!hasRedirected) {
            setTimeout(() => {
              redirectToVSCode(session);
            }, 500);
          }
        } else {
          // User signed up but email confirmation is required
          // DON'T redirect immediately - let the email verification handle it
          // The email verification link will redirect back to VS Code
          // Just show a message (handled in AuthDialog)
        }
      }
      // Don't redirect on TOKEN_REFRESHED or INITIAL_SESSION - those are not user actions
    });

    return () => subscription.unsubscribe();
  }, [checking, hasRedirected, redirectToVSCode, hasSeenInitialAuthEvent, userHasInteracted]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-positive-highlight mx-auto mb-4"></div>
          <p className="text-text-secondary">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="container mx-auto px-4 py-8 max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-text mb-2">VS Code Authentication</h1>
          <p className="text-text-secondary">
            Sign in to authenticate with PastePortal VS Code extension
          </p>
        </div>

        <AuthDialog
          isOpen={authDialogOpen}
          onClose={() => {
            // Don't allow closing - user must authenticate or close the page
            // We'll keep it open but they can close the browser tab
          }}
          initialMode={authMode}
          isVSCodeAuth={true}
          onUserInteraction={() => {
            // Mark that user has interacted with the form (submitted signup/signin)
            // This allows the auth state change listener to process events
            setUserHasInteracted(true);
          }}
        />

        <div className="mt-6 text-center">
          <p className="text-sm text-text-secondary">
            After signing in, you will be automatically redirected to VS Code.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * VS Code Authentication Page
 * This page is opened from VS Code extension for authentication
 * After successful auth, it redirects back to VS Code with tokens
 */
export default function VSCodeAuthPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-positive-highlight mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    }>
      <VSCodeAuthPageContent />
    </Suspense>
  );
}

