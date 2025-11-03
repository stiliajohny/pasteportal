'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthDialog from '@/app/components/AuthDialog';
import { useAuth } from '@/app/contexts/AuthContext';

/**
 * Signup page - Opens authentication dialog in signup mode
 * Accessible at /signup for SEO and direct access
 */
export default function SignupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(true);

  useEffect(() => {
    // If user is already logged in, redirect to home
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleClose = () => {
    setAuthDialogOpen(false);
    // Redirect to home when dialog is closed
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <AuthDialog isOpen={authDialogOpen} onClose={handleClose} initialMode="signup" />
    </div>
  );
}

