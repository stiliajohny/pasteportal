'use client';

import { DetectedSecret, getSecretsSummary } from '@/lib/secret-detection';
import { useEffect, useState } from 'react';

interface SecretWarningDialogProps {
  /**
   * Whether the dialog is open
   */
  isOpen: boolean;
  /**
   * Callback when dialog is closed
   */
  onClose: () => void;
  /**
   * Array of detected secrets
   */
  secrets: DetectedSecret[];
  /**
   * Callback when user chooses to proceed with redaction
   */
  onProceedWithRedaction: () => void;
  /**
   * Callback when user chooses to cancel and edit
   */
  onCancel: () => void;
}

/**
 * Secret Warning Dialog Component
 * 
 * Warns users when secrets are detected in their paste content.
 * Allows users to either remove secrets manually or proceed with automatic redaction.
 */
export default function SecretWarningDialog({
  isOpen,
  onClose,
  secrets,
  onProceedWithRedaction,
  onCancel,
}: SecretWarningDialogProps) {
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

  /**
   * Handle proceed with redaction
   */
  const handleProceed = () => {
    setIsClosing(true);
    setTimeout(() => {
      onProceedWithRedaction();
      onClose();
      setIsClosing(false);
    }, 200);
  };

  /**
   * Handle cancel and edit
   */
  const handleCancel = () => {
    setIsClosing(true);
    setTimeout(() => {
      onCancel();
      onClose();
      setIsClosing(false);
    }, 200);
  };

  if (!isOpen) return null;

  const summary = getSecretsSummary(secrets);
  const highSeverityCount = secrets.filter(s => {
    // Count high severity secrets (AWS, GitHub, Slack, etc.)
    return ['aws-access-key', 'aws-secret-key', 'aws-session-token', 
            'github-token', 'github-oauth', 'slack-token', 'slack-webhook',
            'private-key', 'ssh-private-key', 'database-connection'].includes(s.type);
  }).length;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="secret-warning-dialog-title"
    >
      <div
        className={`bg-surface border border-divider rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transition-transform duration-200 ${
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
                  className="w-6 h-6 text-red-500"
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
                  id="secret-warning-dialog-title"
                  className="text-xl sm:text-2xl font-bold text-text mb-2"
                >
                  Potential Secrets Detected
                </h2>
                <p className="text-text-secondary text-sm sm:text-base">
                  {summary}
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

          {/* Warning Message */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-400 text-sm sm:text-base font-medium mb-2">
              ⚠️ Security Warning
            </p>
            <p className="text-text-secondary text-sm">
              We detected {secrets.length} potential secret{secrets.length !== 1 ? 's' : ''} in your paste content.
              {highSeverityCount > 0 && (
                <span className="block mt-1 font-semibold text-red-400">
                  {highSeverityCount} high-severity secret{highSeverityCount !== 1 ? 's' : ''} detected (AWS keys, GitHub tokens, etc.)
                </span>
              )}
            </p>
            <p className="text-text-secondary text-sm mt-2">
              Sharing secrets publicly can compromise your security. Please remove them before sharing, or we can automatically redact them for you.
            </p>
          </div>

          {/* Detected Secrets List */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-text mb-3">
              Detected Secrets ({secrets.length}):
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {secrets.map((secret, index) => (
                <div
                  key={index}
                  className="bg-surface-secondary border border-divider rounded-lg p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-medium text-text">
                      {secret.description}
                    </span>
                    <span className="text-text-secondary text-xs whitespace-nowrap">
                      Line {secret.lineNumber}, Col {secret.columnNumber}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-text-secondary bg-surface rounded px-2 py-1 mt-1 break-all">
                    {secret.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-3 bg-surface-secondary hover:bg-surface-tertiary text-text font-medium rounded-lg transition-colors min-h-[44px] flex items-center justify-center gap-2"
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Cancel & Edit Manually
            </button>
            <button
              onClick={handleProceed}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors min-h-[44px] flex items-center justify-center gap-2"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Proceed with Redaction
            </button>
          </div>

          {/* Info Note */}
          <p className="text-xs text-text-secondary mt-4 text-center">
            Note: Redaction will replace detected secrets with asterisks (*) before storing your paste.
          </p>
        </div>
      </div>
    </div>
  );
}

