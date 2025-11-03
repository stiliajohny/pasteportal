'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import AuthDialog from './AuthDialog';
import UserMenu from './UserMenu';
import { useAuth } from '../contexts/AuthContext';

/**
 * Header component with logo, navigation, theme toggle, and authentication
 * Follows Apple Design: clean, minimal, with clear hierarchy
 * Follows Law of Common Region: grouped related items
 * Mobile-responsive with hamburger menu
 */
export default function Header() {
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authDialogMode, setAuthDialogMode] = useState<'signin' | 'signup'>('signin');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading, signOut } = useAuth();
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dialog automatically when user successfully authenticates
  useEffect(() => {
    if (user && authDialogOpen) {
      setAuthDialogOpen(false);
    }
  }, [user, authDialogOpen]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(target) &&
        !(target as Element).closest('button[aria-label="Toggle mobile menu"]')
      ) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [mobileMenuOpen]);

  // Note: Menu closes when links are clicked (handled in Link onClick handlers)

  const handleAuthClick = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthDialogMode(mode);
    setAuthDialogOpen(true);
    setMobileMenuOpen(false); // Close mobile menu when opening auth dialog
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-divider bg-header-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-header-background/60 max-w-full overflow-x-hidden relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-full">
          <div className="flex h-14 items-center justify-between w-full">
            {/* Logo and Brand */}
            <Link
              href="/"
              className="flex items-center gap-2 sm:gap-3 group transition-transform duration-200 hover:scale-105"
              aria-label="PastePortal Home"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="relative h-7 w-7 sm:h-10 sm:w-10 flex-shrink-0">
                <Image
                  src="/logo.png"
                  alt="PastePortal Logo"
                  fill
                  className="object-contain"
                  priority
                  sizes="(max-width: 640px) 28px, 40px"
                />
              </div>
              <span className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-teal bg-clip-text text-transparent">
                PastePortal
              </span>
            </Link>

            {/* Desktop Navigation and Actions */}
            <div className="hidden md:flex items-center gap-4">
              {/* Desktop Navigation Links */}
              <nav className="flex items-center gap-6">
                <Link
                  href="https://marketplace.visualstudio.com/items?itemName=JohnStilia.pasteportal"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-tour="extension-link"
                  className="text-sm font-medium text-text-secondary hover:text-neon-magenta transition-colors duration-200 flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M22.6 3.4c-.4-.4-.9-.4-1.3 0L12 12.7 2.7 3.4c-.4-.4-.9-.4-1.3 0s-.4.9 0 1.3l10 10.1 10-10.1c.4-.4.4-.9 0-1.3z" />
                  </svg>
                  <span>Get the Extension</span>
                </Link>
              </nav>

              {/* Auth Button */}
                  {!loading && (
                <div className="flex items-center gap-2 overflow-visible">
                  {user ? (
                    <UserMenu />
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        data-tour="sign-in-button"
                        onClick={() => handleAuthClick('signin')}
                        className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text transition-colors duration-200"
                      >
                        Sign In
                      </button>
                      <button
                        onClick={() => handleAuthClick('signup')}
                        className="px-4 py-2 text-sm font-medium bg-positive-highlight text-black rounded hover:opacity-90 transition-opacity"
                      >
                        Sign Up
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Theme Toggle */}
              <div data-tour="theme-toggle">
                <ThemeToggle />
              </div>
            </div>

            {/* Mobile Menu Button and Actions */}
            <div className="flex md:hidden items-center gap-2">
              {/* Theme Toggle - Always visible on mobile */}
              <ThemeToggle />
              
              {/* Hamburger Menu Button */}
              <button
                type="button"
                data-tour="mobile-menu-button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setMobileMenuOpen((prev) => !prev);
                }}
                className="p-2 rounded-lg hover:bg-surface-variant transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-positive-highlight relative z-[102]"
                aria-label="Toggle mobile menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  // Close icon (X)
                  <svg
                    className="w-6 h-6 text-text"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  // Hamburger icon
                  <svg
                    className="w-6 h-6 text-text"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay - Rendered outside header for proper z-index */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            onTouchStart={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          
          {/* Mobile Menu Panel */}
          <div
            ref={mobileMenuRef}
            data-tour="mobile-menu-panel"
            className={`fixed top-14 left-0 right-0 bottom-0 z-[101] bg-surface border-t border-divider overflow-y-auto md:hidden shadow-xl ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
              <div className="container mx-auto px-4 py-6 space-y-4">
                {/* Navigation Links */}
                <nav className="space-y-2 border-b border-divider pb-4">
                  <Link
                    href="https://marketplace.visualstudio.com/items?itemName=JohnStilia.pasteportal"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-text-secondary hover:text-neon-magenta hover:bg-surface-variant transition-colors duration-200"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M22.6 3.4c-.4-.4-.9-.4-1.3 0L12 12.7 2.7 3.4c-.4-.4-.9-.4-1.3 0s-.4.9 0 1.3l10 10.1 10-10.1c.4-.4.4-.9 0-1.3z" />
                    </svg>
                    <span>Get the Extension</span>
                  </Link>
                </nav>

                {/* Additional Links */}
                <div className="space-y-2 border-b border-divider pb-4">
                  {user && (
                    <>
                      <Link
                        href="/my-pastes"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-text-secondary hover:text-text hover:bg-surface-variant transition-colors duration-200"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span>My Pastes</span>
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-text-secondary hover:text-text hover:bg-surface-variant transition-colors duration-200"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span>Settings</span>
                      </Link>
                    </>
                  )}
                </div>

                {/* Auth Section */}
                {!loading && (
                  <div className="space-y-2 pt-4">
                    {user ? (
                      <div className="px-4 py-2">
                        <div className="flex items-center gap-3 mb-3">
                          {/* Avatar Circle or Profile Picture */}
                          {user?.user_metadata?.avatar_url ? (
                            <Image
                              src={user.user_metadata.avatar_url}
                              alt={user?.user_metadata?.display_name || 
                                   user?.user_metadata?.name || 
                                   user?.email?.split('@')[0] || 
                                   'User'}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-full object-cover border border-divider flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-cyan via-neon-magenta to-neon-teal flex items-center justify-center text-white font-semibold flex-shrink-0">
                              {(user?.user_metadata?.display_name || 
                                user?.user_metadata?.name || 
                                user?.email?.split('@')[0] || 
                                'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text truncate">
                              {user?.user_metadata?.display_name || 
                               user?.user_metadata?.name || 
                               user?.email?.split('@')[0] || 
                               'User'}
                            </p>
                            <p className="text-xs text-text-secondary truncate">
                              {user?.email}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            await signOut();
                            setMobileMenuOpen(false);
                            router.push('/');
                          }}
                          className="w-full px-4 py-3 rounded-lg text-base font-medium bg-surface-variant border border-divider text-text hover:bg-surface transition-colors duration-200 flex items-center justify-center gap-2"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                            />
                          </svg>
                          <span>Sign Out</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleAuthClick('signin')}
                          className="w-full px-4 py-3 rounded-lg text-base font-medium bg-surface-variant border border-divider text-text hover:bg-surface transition-colors duration-200"
                        >
                          Sign In
                        </button>
                        <button
                          onClick={() => handleAuthClick('signup')}
                          className="w-full px-4 py-3 rounded-lg text-base font-medium bg-positive-highlight text-black hover:opacity-90 transition-opacity"
                        >
                          Sign Up
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      <AuthDialog
        isOpen={authDialogOpen}
        onClose={() => setAuthDialogOpen(false)}
        initialMode={authDialogMode}
      />
    </>
  );
}
