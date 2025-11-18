'use client';

import { getHeadersWithCsrf } from '@/lib/csrf-client';
import { writeToClipboard } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ClipboardPermissionBanner from '../components/ClipboardPermissionBanner';
import { useAuth } from '../contexts/AuthContext';

interface Paste {
  id: string;
  name: string | null;
  timestamp: string;
  created_at: string;
  is_password_encrypted: boolean;
  password: string | null; // Decrypted password (only available for user's own pastes)
  tags: string | null; // Comma-separated tags
  platform: string | null; // Platform where paste was created (e.g., 'web', 'vscode')
  hostname: string | null; // Hostname of device where paste was created
  display_name: string;
}

/**
 * My Pastes page
 * Displays all pastes created by the authenticated user
 * Follows Law of UX: Law of Common Region - grouped related pastes
 */
export default function MyPastesPage() {
  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pastes, setPastes] = useState<Paste[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPasswordId, setCopiedPasswordId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [showPasswordProtectedOnly, setShowPasswordProtectedOnly] = useState<boolean>(false);
  const [showClipboardBanner, setShowClipboardBanner] = useState(false);
  const [pendingClipboardText, setPendingClipboardText] = useState<string | null>(null);
  const [selectedPastes, setSelectedPastes] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  /**
   * Fetch user's pastes from API
   */
  const fetchPastes = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // Include access token in Authorization header for API authentication
      // This is needed because the client uses localStorage for sessions,
      // but the server-side API routes need the token to authenticate
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/v1/list-pastes', {
        credentials: 'include', // Include cookies for authentication
        headers,
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch pastes');
      }

      const data = await response.json();
      const pastesData = data.pastes || [];
      
      // Debug logging (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.log('[my-pastes] Received pastes:', pastesData.length);
        if (pastesData.length > 0) {
          console.log('[my-pastes] First paste sample:', {
            id: pastesData[0].id,
            platform: pastesData[0].platform,
            hostname: pastesData[0].hostname,
            hasPlatform: !!pastesData[0].platform,
            hasHostname: !!pastesData[0].hostname,
          });
        }
      }
      
      setPastes(pastesData);
      // Clear selection when pastes are refreshed
      setSelectedPastes(new Set());
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
    
    const copyResult = await writeToClipboard(url);
    if (copyResult.success) {
      setCopiedId(pasteId);
      setTimeout(() => setCopiedId(null), 2000);
      setShowClipboardBanner(false);
    } else if (copyResult.permissionState === 'denied') {
      setPendingClipboardText(url);
      setShowClipboardBanner(true);
    } else {
      // Fallback for older browsers or other errors
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
      // Get headers with CSRF token
      const headers = getHeadersWithCsrf({
        'Content-Type': 'application/json',
      });
      
      // Include access token in Authorization header for API authentication
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/v1/delete-paste?id=${pasteId}`, {
        method: 'DELETE',
        credentials: 'include', // Include cookies for authentication
        headers,
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
      // Remove from selected if it was selected
      setSelectedPastes(prev => {
        const next = new Set(prev);
        next.delete(pasteId);
        return next;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to delete paste');
      console.error('Error deleting paste:', err);
    } finally {
      setDeletingId(null);
    }
  };

  /**
   * Toggle selection of a paste
   * @param pasteId - ID of the paste to toggle
   */
  const togglePasteSelection = (pasteId: string) => {
    setSelectedPastes(prev => {
      const next = new Set(prev);
      if (next.has(pasteId)) {
        next.delete(pasteId);
      } else {
        next.add(pasteId);
      }
      return next;
    });
  };

  /**
   * Toggle select all pastes (based on filtered list)
   * @param filteredPastes - Array of filtered pastes to select/deselect
   */
  const toggleSelectAll = (filteredPastes: Paste[]) => {
    const allSelected = filteredPastes.every(p => selectedPastes.has(p.id));
    
    setSelectedPastes(prev => {
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all filtered pastes
        filteredPastes.forEach(p => next.delete(p.id));
      } else {
        // Select all filtered pastes
        filteredPastes.forEach(p => next.add(p.id));
      }
      return next;
    });
  };

  /**
   * Delete multiple pastes
   * @param pasteIds - Array of paste IDs to delete
   */
  const handleBulkDelete = async (pasteIds: string[]) => {
    const count = pasteIds.length;
    if (!confirm(`Are you sure you want to delete ${count} paste${count > 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }

    setBulkDeleting(true);
    setError(null);

    const headers = getHeadersWithCsrf({
      'Content-Type': 'application/json',
    });
    
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[],
    };

    // Delete pastes sequentially to avoid overwhelming the server
    for (const pasteId of pasteIds) {
      try {
        const response = await fetch(`/api/v1/delete-paste?id=${pasteId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers,
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/');
            setBulkDeleting(false);
            return;
          }
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete paste');
        }

        results.success.push(pasteId);
      } catch (err: any) {
        results.failed.push({
          id: pasteId,
          error: err.message || 'Failed to delete paste',
        });
      }
    }

    // Update the pastes list by removing successfully deleted ones
    if (results.success.length > 0) {
      setPastes(pastes.filter(p => !results.success.includes(p.id)));
      // Clear selection
      setSelectedPastes(new Set());
    }

    // Show error message if any failed
    if (results.failed.length > 0) {
      const failedCount = results.failed.length;
      const successCount = results.success.length;
      setError(
        `Failed to delete ${failedCount} paste${failedCount > 1 ? 's' : ''}. ` +
        (successCount > 0 ? `${successCount} paste${successCount > 1 ? 's' : ''} deleted successfully.` : '')
      );
    }

    setBulkDeleting(false);
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/');
      } else if (session) {
        // Only fetch pastes if we have a session (with access token)
        fetchPastes();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, session, authLoading, router]);

  /**
   * Clear selections for pastes that are no longer visible after filtering
   */
  useEffect(() => {
    // Build filtered list based on all active filters
    const filteredIds = new Set(
      pastes
        .filter((paste) => {
          // Unified search filter
          if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const matchesSearch = 
              paste.display_name?.toLowerCase().includes(query) ||
              paste.tags?.toLowerCase().includes(query) ||
              paste.id.toLowerCase().includes(query) ||
              paste.hostname?.toLowerCase().includes(query);
            if (!matchesSearch) return false;
          }
          
          // Platform filter
          if (selectedPlatform && paste.platform !== selectedPlatform) {
            return false;
          }
          
          // Password protection filter
          if (showPasswordProtectedOnly && !paste.is_password_encrypted) {
            return false;
          }
          
          return true;
        })
        .map(p => p.id)
    );
    
    // Remove selections for pastes that are no longer in the filtered list
    setSelectedPastes(prev => {
      const next = new Set(prev);
      prev.forEach(id => {
        if (!filteredIds.has(id)) {
          next.delete(id);
        }
      });
      return next;
    });
  }, [searchQuery, selectedPlatform, showPasswordProtectedOnly, pastes]);

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

      {/* Unified Search */}
      {pastes.length > 0 && (
        <div className="mb-6 space-y-4">
          <label htmlFor="search-query" className="sr-only">Search all pastes</label>
          <div className="relative">
            <input
              id="search-query"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all pastes (name, tags, ID, hostname)..."
              className="w-full px-4 py-2.5 bg-surface border border-divider/60 rounded-lg text-text placeholder:text-text-secondary/70 focus:outline-none focus:ring-1 focus:ring-neon-teal focus:border-neon-teal transition-all duration-200 text-sm"
              aria-label="Search all pastes by name, tags, ID, or hostname"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text transition-colors"
                aria-label="Clear search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            <div className="flex items-center gap-2 flex-nowrap min-w-max">
              {/* Platform Filters */}
              <button
                onClick={() => setSelectedPlatform(null)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  selectedPlatform === null
                    ? 'bg-positive-highlight text-black'
                    : 'bg-surface-variant border border-divider/60 text-text hover:bg-surface hover:border-positive-highlight/50'
                }`}
                aria-label="Show all platforms"
                aria-pressed={selectedPlatform === null}
              >
                All
              </button>
              {(() => {
                const availablePlatforms = Array.from(
                  new Set(pastes.map(p => p.platform).filter((p): p is string => Boolean(p)))
                ).sort();
                
                return availablePlatforms.map((platform) => {
                  const displayName = platform === 'vscode' ? 'VS Code' : platform.charAt(0).toUpperCase() + platform.slice(1);
                  return (
                    <button
                      key={platform}
                      onClick={() => setSelectedPlatform(platform)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                        selectedPlatform === platform
                          ? 'bg-positive-highlight text-black'
                          : 'bg-surface-variant border border-divider/60 text-text hover:bg-surface hover:border-positive-highlight/50'
                      }`}
                      aria-label={`Filter by ${displayName}`}
                      aria-pressed={selectedPlatform === platform}
                    >
                      {displayName}
                    </button>
                  );
                });
              })()}
              
              {/* Password Protected Filter */}
              <button
                onClick={() => setShowPasswordProtectedOnly(!showPasswordProtectedOnly)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  showPasswordProtectedOnly
                    ? 'bg-positive-highlight text-black'
                    : 'bg-surface-variant border border-divider/60 text-text hover:bg-surface hover:border-positive-highlight/50'
                }`}
                aria-label="Filter password protected pastes"
                aria-pressed={showPasswordProtectedOnly}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Password
              </button>
            </div>
          </div>
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
      ) : (() => {
        const filteredPastes = pastes.filter((paste) => {
          // Unified search filter
          if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const matchesSearch = 
              paste.display_name?.toLowerCase().includes(query) ||
              paste.tags?.toLowerCase().includes(query) ||
              paste.id.toLowerCase().includes(query) ||
              paste.hostname?.toLowerCase().includes(query);
            if (!matchesSearch) return false;
          }
          
          // Platform filter
          if (selectedPlatform && paste.platform !== selectedPlatform) {
            return false;
          }
          
          // Password protection filter
          if (showPasswordProtectedOnly && !paste.is_password_encrypted) {
            return false;
          }
          
          return true;
        });

        // Check if any filters are active
        const hasActiveFilters = searchQuery.trim() || selectedPlatform !== null || showPasswordProtectedOnly;

        if (filteredPastes.length === 0 && hasActiveFilters) {
          const activeFilters: string[] = [];
          if (searchQuery.trim()) activeFilters.push(`search "${searchQuery}"`);
          if (selectedPlatform) {
            const platformName = selectedPlatform === 'vscode' ? 'VS Code' : selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1);
            activeFilters.push(`platform "${platformName}"`);
          }
          if (showPasswordProtectedOnly) activeFilters.push('password protected');

          return (
            <div className="bg-surface border border-divider rounded-lg p-12 text-center">
              <p className="text-text-secondary text-lg mb-4">
                No pastes found matching {activeFilters.join(' and ')}
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedPlatform(null);
                  setShowPasswordProtectedOnly(false);
                }}
                className="px-6 py-2 bg-positive-highlight text-black font-semibold rounded hover:opacity-90 transition-opacity"
              >
                Clear All Filters
              </button>
            </div>
          );
        }

        const allSelected = filteredPastes.length > 0 && filteredPastes.every(p => selectedPastes.has(p.id));
        const someSelected = filteredPastes.some(p => selectedPastes.has(p.id));
        const selectedCount = Array.from(selectedPastes).filter(id => 
          filteredPastes.some(p => p.id === id)
        ).length;

        return (
          <div className="space-y-3">
            {/* Results Count */}
            {hasActiveFilters && filteredPastes.length > 0 && (
              <div className="text-sm text-text-secondary mb-2">
                Showing {filteredPastes.length} of {pastes.length} paste{filteredPastes.length !== 1 ? 's' : ''}
              </div>
            )}
            {/* Bulk Actions Bar */}
            {(someSelected || selectedCount > 0) && (
              <div className="bg-surface border border-positive-highlight/50 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-text font-medium">
                    {selectedCount} paste{selectedCount !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedPastes(new Set())}
                    className="px-4 py-2 bg-surface-variant border border-divider rounded text-text hover:bg-surface hover:border-positive-highlight/50 transition-all text-sm font-medium"
                  >
                    Clear Selection
                  </button>
                  <button
                    onClick={() => handleBulkDelete(Array.from(selectedPastes).filter(id => 
                      filteredPastes.some(p => p.id === id)
                    ))}
                    disabled={bulkDeleting || selectedCount === 0}
                    className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded hover:bg-red-500/30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {bulkDeleting ? (
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
                        Delete Selected
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Select All Checkbox */}
            {filteredPastes.length > 0 && (
              <div className="flex items-center gap-3 pb-3 border-b border-divider/60 mb-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => toggleSelectAll(filteredPastes)}
                    className="w-5 h-5 rounded border-2 border-divider bg-surface accent-positive-highlight text-positive-highlight focus:ring-2 focus:ring-positive-highlight focus:ring-offset-2 focus:ring-offset-surface cursor-pointer transition-all"
                    style={{ accentColor: 'var(--color-positive-highlight)' }}
                    aria-label="Select all pastes"
                  />
                  <span className="text-sm text-text font-medium group-hover:text-positive-highlight transition-colors">
                    Select all ({filteredPastes.length})
                  </span>
                </label>
              </div>
            )}

            {filteredPastes.map((paste) => {
              const pasteTags = paste.tags ? paste.tags.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
              return (
            <div
              key={paste.id}
              className={`bg-surface border rounded-lg p-3 sm:p-4 transition-all duration-200 ${
                selectedPastes.has(paste.id)
                  ? 'border-positive-highlight shadow-lg shadow-positive-highlight/10'
                  : paste.is_password_encrypted
                  ? 'border-yellow-500/40 shadow-lg shadow-yellow-500/5 hover:border-yellow-500/60 hover:shadow-yellow-500/10'
                  : 'border-divider hover:border-positive-highlight/50 hover:shadow-lg hover:shadow-positive-highlight/5'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                {/* Checkbox and Title Row */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex items-start pt-0.5 flex-shrink-0">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPastes.has(paste.id)}
                        onChange={() => togglePasteSelection(paste.id)}
                        className="w-5 h-5 rounded border-2 border-divider bg-surface accent-positive-highlight text-positive-highlight focus:ring-2 focus:ring-positive-highlight focus:ring-offset-2 focus:ring-offset-surface cursor-pointer transition-all"
                        style={{ accentColor: 'var(--color-positive-highlight)' }}
                        aria-label={`Select ${paste.display_name}`}
                      />
                    </label>
                  </div>

                  {/* Main Content Section - Better organized following Laws of UX */}
                  <div className="flex-1 min-w-0">
                    {/* Header Row: Title and Status Badge (Law of Proximity) */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-base sm:text-lg font-bold text-text truncate flex-1 min-w-0">
                        {paste.display_name}
                      </h3>
                      {paste.is_password_encrypted && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/15 border border-yellow-500/40 rounded-md flex-shrink-0">
                          <svg className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span className="text-xs font-semibold text-yellow-400 whitespace-nowrap">
                            Password Protected
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Metadata Group (Law of Common Region) */}
                    <div className="space-y-1.5 sm:space-y-2">
                      {/* Primary Metadata: Date and ID */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-text-secondary">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{formatDate(paste.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                          </svg>
                          <span className="break-all truncate sm:max-w-xs">ID: {paste.id}</span>
                        </div>
                      </div>

                      {/* Secondary Metadata: Platform and Hostname Pills (Icons inside) */}
                      {(paste.platform && paste.platform.trim()) || (paste.hostname && paste.hostname.trim()) ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(paste.platform && paste.platform.trim()) && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-surface-variant border border-divider/60 rounded-md text-xs font-medium text-text-secondary">
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <span className="whitespace-nowrap">
                                {paste.platform === 'vscode' ? 'VS Code' : paste.platform.charAt(0).toUpperCase() + paste.platform.slice(1)}
                              </span>
                            </span>
                          )}
                          {(paste.hostname && paste.hostname.trim()) && (
                            <span 
                              className="inline-flex items-center gap-1.5 px-2 py-1 bg-surface-variant/60 border border-divider/40 rounded-md text-xs font-medium text-text-secondary/90 font-mono"
                              title={`Hostname: ${paste.hostname}`}
                            >
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                              </svg>
                              <span className="truncate max-w-[140px] sm:max-w-none">
                                {paste.hostname}
                              </span>
                            </span>
                          )}
                        </div>
                      ) : null}

                      {/* Tags Display (Law of Common Region) */}
                      {pasteTags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {pasteTags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-0.5 bg-positive-highlight/20 text-positive-highlight border border-positive-highlight/40 rounded-md text-xs font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Section: Action Buttons (Law of Proximity - actions grouped) */}
                <div className="flex flex-col gap-2 flex-shrink-0 sm:ml-auto">
                  <div className="flex flex-row items-center gap-2 sm:flex-col sm:items-stretch">
                    <button
                      onClick={() => router.push(`/?id=${paste.id}`)}
                      className="flex-1 sm:flex-none px-3 py-2 bg-surface-variant border border-divider rounded text-text hover:bg-surface hover:border-positive-highlight/50 transition-all text-sm font-medium flex items-center justify-center gap-1.5 whitespace-nowrap"
                      title="View paste"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span className="hidden sm:inline">View</span>
                    </button>
                    <button
                      onClick={() => copyLink(paste.id)}
                      className="flex-1 sm:flex-none px-3 py-2 bg-positive-highlight text-black rounded hover:opacity-90 transition-opacity text-sm font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap"
                      title="Copy paste link"
                    >
                      {copiedId === paste.id ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="hidden sm:inline">Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span className="hidden sm:inline">Copy Link</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeletePaste(paste.id)}
                      disabled={deletingId === paste.id}
                      className="flex-1 sm:flex-none px-3 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded hover:bg-red-500/30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 whitespace-nowrap"
                      title="Delete paste"
                    >
                      {deletingId === paste.id ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span className="hidden sm:inline">Deleting...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="hidden sm:inline">Delete</span>
                        </>
                      )}
                    </button>
                  </div>
                  {/* Password Options - Below Action Buttons */}
                  {paste.is_password_encrypted && paste.password && (
                    <div className="flex flex-row items-center gap-2">
                      <div className="flex-1 min-w-0 relative">
                        <code className="block w-full bg-background/60 border border-yellow-500/30 px-4 py-2 rounded font-mono text-sm text-text break-all pr-10">
                          {showPasswords[paste.id] ? paste.password : '••••••••'}
                        </code>
                        {!showPasswords[paste.id] && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-yellow-400/60">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setShowPasswords(prev => ({ ...prev, [paste.id]: !prev[paste.id] }))}
                        className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 transition-colors border border-yellow-500/40 text-sm font-medium whitespace-nowrap flex items-center justify-center gap-1.5"
                        title={showPasswords[paste.id] ? 'Hide password' : 'Show password'}
                      >
                        {showPasswords[paste.id] ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={async () => {
                          if (!paste.password) return;
                          const copyResult = await writeToClipboard(paste.password);
                          if (copyResult.success) {
                            setCopiedPasswordId(paste.id);
                            setTimeout(() => setCopiedPasswordId(null), 2000);
                            setShowClipboardBanner(false);
                          } else if (copyResult.permissionState === 'denied') {
                            setPendingClipboardText(paste.password);
                            setShowClipboardBanner(true);
                          }
                        }}
                        className="px-4 py-2 bg-yellow-500 text-black rounded hover:opacity-90 transition-opacity text-sm font-semibold whitespace-nowrap flex items-center justify-center gap-1.5"
                        title="Copy password"
                      >
                        {copiedPasswordId === paste.id ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
          })}
          </div>
        );
      })()}

      {/* Clipboard Permission Banner */}
      <ClipboardPermissionBanner
        visible={showClipboardBanner}
        textToCopy={pendingClipboardText || undefined}
        onPermissionGranted={() => {
          setShowClipboardBanner(false);
        }}
        onCopySuccess={() => {
          setShowClipboardBanner(false);
          setPendingClipboardText(null);
        }}
      />
    </div>
  );
}

