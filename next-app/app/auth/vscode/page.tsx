'use client';

import { Suspense, useEffect, useState } from 'react';
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

  useEffect(() => {
    // Check if user is already authenticated
    if (user && session) {
      // User is authenticated, redirect back to VS Code with tokens
      redirectToVSCode(session);
    } else {
      setChecking(false);
    }
  }, [user, session]);

  useEffect(() => {
    // Check for mode parameter
    const mode = searchParams.get('mode');
    if (mode === 'signup') {
      setAuthMode('signup');
    }
  }, [searchParams]);

  /**
   * Redirect to VS Code with authentication tokens
   */
  const redirectToVSCode = (session: any) => {
    if (!session) return;

    const params = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token || '',
      expires_at: session.expires_at?.toString() || '',
      expires_in: session.expires_in?.toString() || '3600',
      token_type: session.token_type || 'bearer',
    });

    // Redirect to VS Code
    window.location.href = `vscode://JohnStilia.pasteportal/auth-callback?${params.toString()}`;
  };

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
            
            redirectToVSCode(data.session);
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
          if (session) {
            redirectToVSCode(session);
          }
        }, 1000);
      }
    }
    
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && session.user && !checking) {
        // User just authenticated (via email/password, etc.), redirect to VS Code
        setTimeout(() => {
          redirectToVSCode(session);
        }, 500);
      }
    });

    return () => subscription.unsubscribe();
  }, [checking]);

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

