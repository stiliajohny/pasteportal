'use client';

import { useEffect, useState } from 'react';
import { useTour } from './Tour';

/**
 * TourTrigger component - Button to start the tour
 * Flashes and attracts attention for new users who haven't completed the tour
 */
export default function TourTrigger() {
  const { startTour, isTourCompleted, tourReady } = useTour();
  const [mounted, setMounted] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCompleted(isTourCompleted());
    
    // Listen for storage changes to update button state immediately
    const handleStorageChange = () => {
      setCompleted(isTourCompleted());
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically (in case of same-window updates)
    const interval = setInterval(() => {
      setCompleted(isTourCompleted());
    }, 500);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [isTourCompleted]);

  const handleClick = () => {
    // Always try to get the latest tour function from window object
    const tour = typeof window !== 'undefined' ? (window as any).__pasteportalTour : null;
    
    if (!tour?.start) {
      console.warn('Tour is not ready yet. Please wait a moment and try again.');
      // Retry after a short delay
      setTimeout(() => {
        const retryTour = typeof window !== 'undefined' ? (window as any).__pasteportalTour : null;
        if (retryTour?.start) {
          retryTour.start();
        }
      }, 500);
      return;
    }
    
    // Use the function from window object to ensure we have the latest reference
    tour.start();
  };

  if (!mounted) return null;

  // Colorful styling - always colorful, with extra animations for new users
  const buttonClasses = !completed
    ? 'relative bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-teal text-black font-semibold px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 animate-pulse hover:animate-none border-2 border-transparent hover:border-neon-cyan'
    : 'relative bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-teal text-black font-semibold px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-2 border-transparent hover:border-neon-cyan';

  return (
    <button
      onClick={handleClick}
      disabled={!tourReady}
      className={`${buttonClasses} flex items-center gap-2 relative overflow-hidden ${!tourReady ? 'opacity-50 cursor-wait' : ''}`}
      aria-label="Take tour"
      title={!tourReady ? 'Loading tour...' : (completed ? 'Take a guided tour of PastePortal' : '🎯 New! Take a quick tour to discover all features')}
    >
      {/* Animated background for new users */}
      {!completed && (
        <>
          <span className="absolute inset-0 bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-teal opacity-75 animate-ping" />
          <span className="absolute inset-0 bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-teal opacity-50 animate-pulse" />
        </>
      )}
      
      <span className="relative z-10 flex items-center gap-2">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={!completed ? { animation: 'spin 3s linear infinite' } : {}}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        <span>
          {!completed ? (
            <span className="flex items-center gap-1.5">
              <span className="hidden sm:inline">✨ Take Tour</span>
              <span className="sm:hidden">Tour</span>
              <span className="inline-flex items-center justify-center w-2 h-2 bg-black rounded-full animate-ping" aria-label="New tour available" />
            </span>
          ) : (
            <>
              <span className="hidden sm:inline">Take Tour</span>
              <span className="sm:hidden">Tour</span>
            </>
          )}
        </span>
      </span>

    </button>
  );
}

