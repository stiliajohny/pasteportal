'use client';

import { Suspense, useCallback, useEffect, useState, useRef } from 'react';
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
  const hasRedirectedRef = useRef(false); // Use ref instead of state to avoid circular dependencies
  const [hasSeenInitialAuthEvent, setHasSeenInitialAuthEvent] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [codeExchangeAttempted, setCodeExchangeAttempted] = useState(false);

  /**
   * Redirect to VS Code with authentication tokens
   */
  const redirectToVSCode = useCallback((session: any) => {
    console.log('[VS Code Auth Page] redirectToVSCode called with session:', !!session, 'hasRedirected:', hasRedirectedRef.current);
    
    if (!session) {
      console.error('[VS Code Auth Page] No session provided to redirectToVSCode');
      return;
    }
    
    if (hasRedirectedRef.current) {
      console.log('[VS Code Auth Page] Already redirected, skipping');
      return;
    }
    
    // Mark as redirected using ref (won't trigger re-render)
    hasRedirectedRef.current = true;
    console.log('[VS Code Auth Page] Set hasRedirectedRef.current = true');
    
    // Clear the VS Code auth pending flag since we're redirecting
    localStorage.removeItem('vscode_auth_pending');

    const params = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token || '',
      expires_at: session.expires_at?.toString() || '',
      expires_in: session.expires_in?.toString() || '3600',
      token_type: session.token_type || 'bearer',
    });

    const vscodeUri = `vscode://JohnStilia.pasteportal/auth-callback?${params.toString()}`;
    console.log('[VS Code Auth Page] Redirecting to VS Code URI:', vscodeUri);
    
    // Redirect to VS Code
    window.location.href = vscodeUri;
    
    console.log('[VS Code Auth Page] window.location.href set, redirect should happen now');
  }, []); // Empty dependencies - no need to recreate this function

  useEffect(() => {
    console.log('[VS Code Auth Page] useEffect for initial session check');
    
    // Mark that this is a VS Code auth session
    // This will be checked after email verification
    localStorage.setItem('vscode_auth_pending', 'true');
    
    // Only check for existing session if there's a code or hash in URL (OAuth callback)
    // Otherwise, let the user sign up/sign in fresh - DO NOT redirect on initial load
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const hash = window.location.hash.substring(1);
    
    console.log('[VS Code Auth Page] URL check:', { code: !!code, hash: !!hash, user: !!user, session: !!session, hasRedirected: hasRedirectedRef.current });
    
    // If there's no OAuth callback, just show the auth dialog
    // DO NOT redirect even if user has existing session - let them sign up/sign in fresh
    if (!code && !hash) {
      console.log('[VS Code Auth Page] No OAuth callback detected, showing auth dialog');
      setChecking(false);
      return;
    }
    
    // If there's a callback (OAuth or magic link), handle it in the other useEffect
    // But still check if we already have a valid session from the callback
    if (user && session && (code || hash)) {
      console.log('[VS Code Auth Page] OAuth callback detected with session already available');
      // Only redirect if we have a callback AND a session
      // This means user came from OAuth and already has session
      if (!hasRedirectedRef.current) {
        console.log('[VS Code Auth Page] Redirecting immediately (session available from callback)');
        redirectToVSCode(session);
      } else {
        console.log('[VS Code Auth Page] Already redirected, skipping immediate redirect');
      }
    } else {
      console.log('[VS Code Auth Page] OAuth callback detected but waiting for session');
      setChecking(false);
    }
  }, [user, session, redirectToVSCode]);

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
      // OAuth callback with code - let Supabase handle code exchange automatically
      // The Supabase client will automatically exchange the code when it initializes
      // We just need to wait for the session to be available via the auth state listener
      console.log('[VS Code Auth Page] OAuth callback detected - waiting for automatic code exchange...');
      
      // Mark user as having interacted since they completed OAuth flow
      // This allows the auth state listener to process the SIGNED_IN event
      setUserHasInteracted(true);
      
      // Check if code verifier exists (for debugging)
      if (typeof window !== 'undefined') {
        console.log('[VS Code Auth Page] Checking for code verifier on OAuth callback...');
        console.log('[VS Code Auth Page] SessionStorage keys:', Object.keys(window.sessionStorage));
        console.log('[VS Code Auth Page] LocalStorage keys:', Object.keys(window.localStorage));
        
        const fixedKey = 'supabase-pkce-code-verifier';
        const codeVerifier = window.sessionStorage.getItem(fixedKey) || window.localStorage.getItem(fixedKey);
        
        if (codeVerifier) {
          console.log(`[VS Code Auth Page] Code verifier found in ${window.sessionStorage.getItem(fixedKey) ? 'sessionStorage' : 'localStorage'}`);
        } else {
          console.error('[VS Code Auth Page] Code verifier NOT found in fixed key!');
        }
      }
      
      // If we already have a session from auto-exchange, redirect immediately
      if (session && !hasRedirectedRef.current) {
        console.log('[VS Code Auth Page] Session already available from auto-exchange');
        redirectToVSCode(session);
      }
      
      // Mark that we're handling OAuth callback
      setCodeExchangeAttempted(true);
    } else if (hash) {
      // Magic link callback with tokens in hash
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get('access_token');
      
      if (accessToken) {
        // Wait a bit for Supabase to process, then check session
        setTimeout(async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && !hasRedirectedRef.current) {
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
      // Check if it's from OAuth callback
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const hash = window.location.hash.substring(1);
      
      // For OAuth callbacks, we DO want to handle SIGNED_IN events
      // Only skip if it's INITIAL_SESSION (not a real auth event)
      if ((code || hash) && event === 'INITIAL_SESSION') {
        console.log('[VS Code Auth Page] Skipping INITIAL_SESSION from OAuth callback');
        return;
      }
      
      // Only redirect on actual authentication events (SIGNED_IN, SIGNED_UP)
      if (event === 'SIGNED_IN') {
        console.log('[VS Code Auth Page] SIGNED_IN event received, session:', !!session);
        console.log('[VS Code Auth Page] Session user:', !!session?.user, 'hasRedirected:', hasRedirectedRef.current);
        if (session && session.user && !hasRedirectedRef.current) {
          console.log('[VS Code Auth Page] Scheduling redirect to VS Code in 500ms...');
          // User just authenticated (via email/password, etc.), redirect to VS Code
          setTimeout(() => {
            console.log('[VS Code Auth Page] Timeout fired, calling redirectToVSCode...');
            redirectToVSCode(session);
          }, 500);
        } else {
          console.log('[VS Code Auth Page] Redirect conditions not met:', {
            hasSession: !!session,
            hasUser: !!session?.user,
            hasRedirected: hasRedirectedRef.current
          });
        }
      }
      // Note: SIGNED_UP is not a valid auth event type in Supabase
      // Signups that result in immediate sessions will trigger SIGNED_IN event
      // Signups requiring email confirmation will be handled via email verification flow
      // Don't redirect on TOKEN_REFRESHED or INITIAL_SESSION - those are not user actions
    });

    return () => subscription.unsubscribe();
  }, [checking, redirectToVSCode, hasSeenInitialAuthEvent, userHasInteracted, session, codeExchangeAttempted]);

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

