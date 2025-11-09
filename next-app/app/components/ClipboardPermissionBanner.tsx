'use client';

import { requestClipboardPermission, writeToClipboard, type ClipboardPermissionState } from '@/lib/utils';
import { useState, useEffect } from 'react';

/**
 * Props for ClipboardPermissionBanner component
 */
interface ClipboardPermissionBannerProps {
  /**
   * Whether the banner should be visible
   */
  visible: boolean;
  /**
   * Callback when permission is granted
   */
  onPermissionGranted?: () => void;
  /**
   * Optional text to copy after permission is granted
   */
  textToCopy?: string;
  /**
   * Callback when copy operation succeeds
   */
  onCopySuccess?: () => void;
}

/**
 * Visual banner component that displays when clipboard permissions are denied
 * Allows users to request permissions again by clicking on it
 */
export default function ClipboardPermissionBanner({
  visible,
  onPermissionGranted,
  textToCopy,
  onCopySuccess,
}: ClipboardPermissionBannerProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionState, setPermissionState] = useState<ClipboardPermissionState>('denied');

  /**
   * Handle click to request clipboard permissions
   */
  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const newState = await requestClipboardPermission();
      setPermissionState(newState);

      if (newState === 'granted') {
        onPermissionGranted?.();

        // If there's text to copy, try copying it now
        if (textToCopy) {
          const result = await writeToClipboard(textToCopy);
          if (result.success) {
            onCopySuccess?.();
          }
        }
      }
    } catch (err) {
      console.error('Failed to request clipboard permission:', err);
    } finally {
      setIsRequesting(false);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <div
      onClick={handleRequestPermission}
      className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 
                 bg-yellow-500 dark:bg-yellow-600 text-black 
                 px-6 py-3 rounded-lg shadow-lg 
                 cursor-pointer hover:bg-yellow-600 dark:hover:bg-yellow-700 
                 transition-all duration-200 ease-in-out
                 flex items-center gap-3
                 max-w-md mx-4
                 animate-pulse"
      role="alert"
      aria-live="polite"
    >
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <div className="flex-1">
        <p className="font-semibold text-sm">
          {isRequesting ? 'Requesting clipboard permission...' : 'Clipboard permission denied'}
        </p>
        <p className="text-xs opacity-90 mt-0.5">
          Click here to enable clipboard access
        </p>
      </div>
      {isRequesting && (
        <svg
          className="w-5 h-5 animate-spin flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
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
      )}
    </div>
  );
}

