'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

interface Paste {
  id: string;
  name: string | null;
  timestamp: string;
  created_at: string;
  is_password_encrypted: boolean;
  password: string | null; // Decrypted password (only available for user's own pastes)
  display_name: string;
}

/**
 * My Pastes page
 * Displays all pastes created by the authenticated user
 * Follows Law of UX: Law of Common Region - grouped related pastes
 */
export default function MyPastesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pastes, setPastes] = useState<Paste[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /**
   * Fetch user's pastes from API
   */
  const fetchPastes = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/list-pastes', {
        credentials: 'include', // Include cookies for authentication
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch pastes');
      }

      const data = await response.json();
      setPastes(data.pastes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load pastes');
      console.error('Error fetching pastes:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Copy paste link to clipboard
   * @param pasteId - ID of the paste to copy
   */
  const copyLink = async (pasteId: string) => {
    const url = `${window.location.origin}/?id=${pasteId}`;
    
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(pasteId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedId(pasteId);
        setTimeout(() => setCopiedId(null), 2000);
      } catch (fallbackErr) {
        alert('Failed to copy link. Please copy manually: ' + url);
      }
      document.body.removeChild(textArea);
    }
  };

  /**
   * Format date for display
   * @param dateString - ISO date string
   * @returns Formatted date string
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  /**
   * Delete a paste
   * @param pasteId - ID of the paste to delete
   */
  const handleDeletePaste = async (pasteId: string) => {
    if (!confirm('Are you sure you want to delete this paste? This action cannot be undone.')) {
      return;
    }

    setDeletingId(pasteId);
    setError(null);

    try {
      const response = await fetch(`/api/v1/delete-paste?id=${pasteId}`, {
        method: 'DELETE',
        credentials: 'include', // Include cookies for authentication
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/');
          return;
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to delete this paste');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete paste');
      }

      // Remove the paste from the list
      setPastes(pastes.filter(p => p.id !== pasteId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete paste');
      console.error('Error deleting paste:', err);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/');
      } else {
        fetchPastes();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-positive-highlight"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text mb-2">My Pastes</h1>
        <p className="text-text-secondary">View and manage your pastes</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded text-red-400">
          {error}
          <button
            onClick={fetchPastes}
            className="ml-4 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {pastes.length === 0 ? (
        <div className="bg-surface border border-divider rounded-lg p-12 text-center">
          <p className="text-text-secondary text-lg mb-4">
            You haven&apos;t created any pastes yet.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-positive-highlight text-black font-semibold rounded hover:opacity-90 transition-opacity"
          >
            Create Your First Paste
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {pastes.map((paste) => (
            <div
              key={paste.id}
              className="bg-surface border border-divider rounded-lg p-4 sm:p-6 hover:border-positive-highlight/50 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-text truncate">
                      {paste.display_name}
                    </h3>
                    {paste.is_password_encrypted && (
                      <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30 whitespace-nowrap">
                        🔒 Password Protected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary mb-2">
                    Created: {formatDate(paste.created_at)}
                  </p>
                  <p className="text-xs text-text-secondary font-mono mb-2 break-all">
                    ID: {paste.id}
                  </p>
                  {/* Show password if available and paste is password-protected */}
                  {paste.is_password_encrypted && paste.password && (
                    <div className="mt-2 p-3 bg-neon-magenta/10 border border-neon-magenta/30 rounded">
                      <div className="flex items-start gap-2 mb-2">
                        <svg className="w-4 h-4 text-neon-magenta mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-text mb-1">Password</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="flex-1 min-w-0 bg-background/50 border border-neon-magenta/20 px-2 py-1 rounded font-mono text-xs text-text break-all">
                          {showPasswords[paste.id] ? paste.password : '••••••••'}
                        </code>
                        <button
                          onClick={() => setShowPasswords(prev => ({ ...prev, [paste.id]: !prev[paste.id] }))}
                          className="px-2 py-1 text-xs bg-neon-magenta/20 text-neon-magenta rounded hover:bg-neon-magenta/30 transition-colors border border-neon-magenta/30 whitespace-nowrap"
                          title={showPasswords[paste.id] ? 'Hide password' : 'Show password'}
                        >
                          {showPasswords[paste.id] ? 'Hide' : 'Show'}
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(paste.password!);
                              setCopiedId(paste.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            } catch (err) {
                              console.error('Failed to copy password:', err);
                              alert('Failed to copy password. Please copy manually.');
                            }
                          }}
                          className="px-2 py-1 text-xs bg-neon-magenta text-white rounded hover:opacity-90 transition-opacity whitespace-nowrap"
                          title="Copy password"
                        >
                          {copiedId === paste.id ? '✓' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                  <button
                    onClick={() => router.push(`/?id=${paste.id}`)}
                    className="px-4 py-2 bg-surface-variant border border-divider rounded text-text hover:bg-surface transition-colors text-sm font-medium text-center"
                  >
                    View
                  </button>
                  <button
                    onClick={() => copyLink(paste.id)}
                    className="px-4 py-2 bg-positive-highlight text-black rounded hover:opacity-90 transition-opacity text-sm font-semibold text-center"
                  >
                    {copiedId === paste.id ? '✓ Copied!' : 'Copy Link'}
                  </button>
                  <button
                    onClick={() => handleDeletePaste(paste.id)}
                    disabled={deletingId === paste.id}
                    className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded hover:bg-red-500/30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    title="Delete paste"
                  >
                    {deletingId === paste.id ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

