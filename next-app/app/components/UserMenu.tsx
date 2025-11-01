'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';

/**
 * User menu dropdown component
 * Displays user avatar/initial and provides menu options
 * Follows Law of UX: Hick's Law - organized menu options
 */
export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  /**
   * Truncates text to a maximum length with ellipsis
   * @param text - Text to truncate
   * @param maxLength - Maximum length before truncation
   * @returns Truncated text with ellipsis
   */
  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  // Get user display name or email
  const fullDisplayName = user?.user_metadata?.display_name || 
                         user?.user_metadata?.name || 
                         user?.email?.split('@')[0] || 
                         'User';
  
  const displayName = truncateText(fullDisplayName, 20);
  const userInitial = fullDisplayName.charAt(0).toUpperCase();
  
  // Get profile picture URL from user metadata
  const profilePictureUrl = user?.user_metadata?.avatar_url;
  
  // Truncate email for display
  const truncatedEmail = user?.email ? truncateText(user.email, 30) : '';

  // Handle mounting for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate menu position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: buttonRect.bottom + window.scrollY + 8,
        right: window.innerWidth - buttonRect.right,
      });
    }
  }, [isOpen]);

  // Close menu when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
    router.push('/');
  };

  if (!user) return null;

  return (
    <div className="relative overflow-visible">
      {/* User Avatar Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-variant transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-positive-highlight"
        aria-label="User menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Avatar Circle or Profile Picture */}
        {profilePictureUrl ? (
          <img
            src={profilePictureUrl}
            alt={fullDisplayName}
            className="w-8 h-8 rounded-full object-cover border border-divider"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-cyan via-neon-magenta to-neon-teal flex items-center justify-center text-white font-semibold text-sm">
            {userInitial}
          </div>
        )}
        {/* User Info - Hidden on mobile, visible on larger screens */}
        <div className="hidden sm:flex flex-col items-start min-w-0 max-w-[140px]">
          <span className="text-sm font-medium text-text truncate w-full" title={fullDisplayName}>
            {displayName}
          </span>
          <span className="text-xs text-text-secondary truncate w-full" title={user.email || ''}>
            {truncatedEmail}
          </span>
        </div>
        {/* Chevron Icon */}
        <svg
          className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu - Rendered via Portal */}
      {mounted && isOpen && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[55]"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          
          {/* Menu */}
          <div
            ref={menuRef}
            className="fixed w-56 bg-surface border border-divider rounded-lg shadow-xl z-[60] py-2"
            style={{
              top: `${menuPosition.top}px`,
              right: `${menuPosition.right}px`,
            }}
            role="menu"
          >
            {/* User Info Section */}
            <div className="px-4 py-3 border-b border-divider">
              <p className="text-sm font-medium text-text truncate" title={fullDisplayName}>
                {fullDisplayName}
              </p>
              <p className="text-xs text-text-secondary truncate" title={user.email || ''}>
                {user.email}
              </p>
            </div>

            {/* Menu Items */}
            <Link
              href="/my-pastes"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:bg-surface-variant hover:text-text transition-colors duration-200"
              role="menuitem"
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
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:bg-surface-variant hover:text-text transition-colors duration-200"
              role="menuitem"
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

            <div className="border-t border-divider my-2" />

            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:bg-surface-variant hover:text-text transition-colors duration-200"
              role="menuitem"
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
        </>,
        document.body
      )}
    </div>
  );
}

