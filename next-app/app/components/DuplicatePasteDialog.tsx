'use client';

import { useEffect, useState } from 'react';

interface DuplicatePasteDialogProps {
  /**
   * Whether the dialog is open
   */
  isOpen: boolean;
  /**
   * Callback when dialog is closed
   */
  onClose: () => void;
}

/**
 * Duplicate Paste Dialog Component
 * 
 * Informs users when they attempt to submit a paste that already exists.
 * Does not expose the paste ID for security/privacy reasons.
 */
export default function DuplicatePasteDialog({
  isOpen,
  onClose,
}: DuplicatePasteDialogProps) {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
    }
  }, [isOpen]);

  /**
   * Handle dialog close with animation
   */
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-paste-dialog-title"
    >
      <div
        className={`bg-surface border border-divider rounded-2xl shadow-2xl max-w-md w-full transition-transform duration-200 ${
          isClosing ? 'scale-95' : 'scale-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6 gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="flex-shrink-0 mt-1">
                <svg
                  className="w-6 h-6 text-yellow-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h2
                  id="duplicate-paste-dialog-title"
                  className="text-xl sm:text-2xl font-bold text-text mb-2"
                >
                  Paste Already Exists
                </h2>
                <p className="text-text-secondary text-sm sm:text-base">
                  This paste content has already been submitted.
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-text-secondary hover:text-text transition-colors p-1 flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close dialog"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Message */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
            <p className="text-yellow-400 text-sm sm:text-base font-medium mb-2">
              ℹ️ Information
            </p>
            <p className="text-text-secondary text-sm">
              The existing paste will be loaded automatically. You can view and share it using the link above.
            </p>
          </div>

          {/* Action Button */}
          <div className="flex justify-end">
            <button
              onClick={handleClose}
              className="px-6 py-3 bg-positive-highlight hover:opacity-90 text-black font-medium rounded-lg transition-opacity min-h-[44px] flex items-center justify-center gap-2"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

