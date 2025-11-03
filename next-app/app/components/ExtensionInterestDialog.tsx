'use client';

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * IDE options for extension interest
 */
const IDE_OPTIONS = [
  { id: 'vscode', name: 'VS Code', icon: '💻' },
  { id: 'jetbrains', name: 'JetBrains (IntelliJ, WebStorm, etc.)', icon: '🔷' },
  { id: 'vim', name: 'Vim/Neovim', icon: '✏️' },
  { id: 'other', name: 'Other', icon: '📝' },
] as const;

type IDEPreference = typeof IDE_OPTIONS[number]['id'];

interface ExtensionInterestDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Dialog for registering interest in IDE extensions
 * Follows Law of Common Region and Law of Proximity for grouping
 */
export default function ExtensionInterestDialog({
  isOpen,
  onClose,
}: ExtensionInterestDialogProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [selectedIDEs, setSelectedIDEs] = useState<Set<IDEPreference>>(new Set());
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  /**
   * Handles toggling IDE selection
   */
  const handleToggleIDE = (ideId: IDEPreference) => {
    setSelectedIDEs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ideId)) {
        newSet.delete(ideId);
      } else {
        newSet.add(ideId);
      }
      return newSet;
    });
  };

  /**
   * Handles form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate
      if (!user && !email) {
        setError('Please enter your email address');
        setLoading(false);
        return;
      }

      if (selectedIDEs.size === 0) {
        setError('Please select at least one IDE');
        setLoading(false);
        return;
      }

      // Use user's email if logged in, otherwise use provided email
      const emailToUse = user?.email || email;

      // Submit interest for each selected IDE
      const promises = Array.from(selectedIDEs).map(async (ide) => {
        const response = await fetch('/api/extension-interest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: emailToUse,
            ide_preference: ide,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to register interest');
        }

        return response.json();
      });

      await Promise.all(promises);

      setSuccess(true);
      setTimeout(() => {
        onClose();
        // Reset state after closing
        setTimeout(() => {
          setSuccess(false);
          setEmail('');
          setSelectedIDEs(new Set());
          setError('');
        }, 300);
      }, 2000);
    } catch (err) {
      console.error('Error registering interest:', err);
      setError(err instanceof Error ? err.message : 'Failed to register interest');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles dialog close
   */
  const handleClose = () => {
    if (!loading) {
      onClose();
      // Reset state after animation
      setTimeout(() => {
        setEmail('');
        setSelectedIDEs(new Set());
        setError('');
        setSuccess(false);
      }, 300);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="extension-dialog-title"
    >
      <div
        className="bg-surface border border-divider rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {success ? (
          // Success State
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-positive-highlight/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-positive-highlight"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-text mb-2">
              Thank You!
            </h2>
            <p className="text-text-secondary">
              We'll notify you when the extension{selectedIDEs.size > 1 ? 's are' : ' is'} ready.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b border-divider flex items-center justify-between">
              <h2
                id="extension-dialog-title"
                className="text-xl font-bold text-text"
              >
                Coming Soon: IDE Extensions
              </h2>
              <button
                onClick={handleClose}
                disabled={loading}
                className="p-1 rounded-lg hover:bg-surface-variant transition-colors duration-200 disabled:opacity-50"
                aria-label="Close dialog"
              >
                <svg
                  className="w-6 h-6 text-text-secondary"
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
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Message */}
              <div className="space-y-2">
                <p className="text-text-secondary text-sm">
                  We're working hard to bring PastePortal to your favorite IDE! 
                  Register your interest below and we'll notify you when it's ready.
                </p>
              </div>

              {/* Email Input (only if not logged in) */}
              {!user && (
                <div className="space-y-2">
                  <label
                    htmlFor="interest-email"
                    className="block text-sm font-medium text-text"
                  >
                    Your Email
                  </label>
                  <input
                    id="interest-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    disabled={loading}
                    className="w-full px-4 py-2.5 bg-background border border-divider rounded-lg text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-positive-highlight focus:border-transparent disabled:opacity-50 transition-all duration-200"
                  />
                </div>
              )}

              {/* IDE Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-text">
                  Which IDE(s) are you interested in?
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {IDE_OPTIONS.map((ide) => (
                    <button
                      key={ide.id}
                      type="button"
                      onClick={() => handleToggleIDE(ide.id)}
                      disabled={loading}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all duration-200 disabled:opacity-50 ${
                        selectedIDEs.has(ide.id)
                          ? 'border-positive-highlight bg-positive-highlight/10 text-text'
                          : 'border-divider bg-background hover:bg-surface-variant text-text-secondary hover:text-text'
                      }`}
                    >
                      <span className="text-2xl">{ide.icon}</span>
                      <span className="flex-1 text-left font-medium">
                        {ide.name}
                      </span>
                      {selectedIDEs.has(ide.id) && (
                        <svg
                          className="w-5 h-5 text-positive-highlight"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-destructive-highlight/10 border border-destructive-highlight/20 rounded-lg">
                  <p className="text-sm text-destructive-highlight">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || selectedIDEs.size === 0}
                className="w-full px-4 py-3 bg-positive-highlight text-black font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Registering...</span>
                  </>
                ) : (
                  <span>Notify Me</span>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

