'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

/**
 * Client-side callback page for handling OAuth redirects
 * This handles the case where server-side cookie setting might not work
 */
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      // Check for code in query params (normal web OAuth flow)
      const supabase = createClient();
      const code = searchParams.get('code');

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
