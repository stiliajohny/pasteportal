'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useTheme } from '@/app/components/ThemeProvider';
import { desktopTourSteps, mobileTourSteps, filterTourSteps, convertToDriverSteps } from './tourSteps';
import { getTourConfig, injectTourStyles } from './tourStyles';
import 'driver.js/dist/driver.css';

/**
 * LocalStorage keys for tour state
 */
const TOUR_STORAGE_KEYS = {
  completed: 'pasteportal-tour-completed',
  skipped: 'pasteportal-tour-skipped',
  device: 'pasteportal-tour-device',
  version: 'pasteportal-tour-version',
} as const;

const TOUR_VERSION = '1.0.0';

/**
 * Device type detection
 */
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768; // md breakpoint
};

/**
 * Check if tour should be shown automatically
 */
const shouldShowTourAutomatically = (): boolean => {
  if (typeof window === 'undefined') return false;

  const completed = localStorage.getItem(TOUR_STORAGE_KEYS.completed) === 'true';
  const skipped = localStorage.getItem(TOUR_STORAGE_KEYS.skipped) === 'true';
  const lastVersion = localStorage.getItem(TOUR_STORAGE_KEYS.version);

  // Show tour if not completed and not skipped, or if version changed
  return (!completed && !skipped) || lastVersion !== TOUR_VERSION;
};

/**
 * Tour component that manages the guided tour using Driver.js
 * Handles device detection, conditional steps, mobile menu locking, and persistence
 */
export default function Tour() {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const driverRef = useRef<any>(null);
  const mobileMenuStateRef = useRef<{ wasOpen: boolean }>({ wasOpen: false });

  /**
   * Close mobile menu if open
   */
  const closeMobileMenu = useCallback(() => {
    const menuButton = document.querySelector('[aria-label="Toggle mobile menu"]') as HTMLButtonElement;
    const menuPanel = document.querySelector('[data-tour="mobile-menu-panel"]') || 
                      document.querySelector('.fixed.top-14.left-0.right-0.bottom-0.z-\\[101\\]');
    
    if (menuPanel && menuPanel.classList.contains('mobile-menu-open')) {
      // Check if menu is open by looking for the backdrop or panel visibility
      const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
      if (backdrop || menuPanel) {
        menuButton?.click();
        mobileMenuStateRef.current.wasOpen = true;
      }
    }
  }, []);

  /**
   * Lock mobile menu closed during tour
   */
  const lockMobileMenu = useCallback(() => {
    if (typeof window === 'undefined') return;

    const menuButton = document.querySelector('[aria-label="Toggle mobile menu"]') as HTMLButtonElement;
    if (!menuButton) return;

    // Prevent menu from opening
    const originalClick = menuButton.onclick;
    menuButton.dataset.tourLocked = 'true';
    
    // Add event listener to prevent menu opening
    const preventMenu = (e: Event) => {
      if (menuButton.dataset.tourLocked === 'true') {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    menuButton.addEventListener('click', preventMenu, true);
    
    // Store cleanup function
    (menuButton as any).__tourPreventMenu = preventMenu;
  }, []);

  /**
   * Unlock mobile menu after tour
   */
  const unlockMobileMenu = useCallback(() => {
    if (typeof window === 'undefined') return;

    const menuButton = document.querySelector('[aria-label="Toggle mobile menu"]') as HTMLButtonElement;
    if (!menuButton) return;

    delete menuButton.dataset.tourLocked;
    const preventMenu = (menuButton as any).__tourPreventMenu;
    if (preventMenu) {
      menuButton.removeEventListener('click', preventMenu, true);
      delete (menuButton as any).__tourPreventMenu;
    }
  }, []);

  /**
   * Start the tour
   */
  const startTour = useCallback(async () => {
    if (typeof window === 'undefined' || driverRef.current) return;

    try {
      // Dynamically import Driver.js
      const { driver } = await import('driver.js');

      // Close mobile menu before starting
      closeMobileMenu();
      
      // Lock mobile menu during tour
      lockMobileMenu();

      // Detect device type
      const isMobile = isMobileDevice();
      const baseSteps = isMobile ? mobileTourSteps : desktopTourSteps;

      // Get current text state (check if textarea has content)
      const textarea = document.querySelector('[data-tour="main-editor"]') as HTMLTextAreaElement;
      const hasText = textarea?.value?.trim().length > 0;

      // Filter steps based on conditions
      const filteredSteps = filterTourSteps(baseSteps, {
        isAuthenticated: !!user,
        hasText,
      });

      if (filteredSteps.length === 0) {
        console.warn('No valid tour steps found');
        unlockMobileMenu();
        return;
      }

      // Convert to Driver.js format
      const driverSteps = convertToDriverSteps(filteredSteps);

      // Debug: Verify elements exist
      const stepDebug = filteredSteps.map(s => {
        const element = document.querySelector(s.element);
        return {
          selector: s.element,
          exists: element !== null,
          visible: element ? window.getComputedStyle(element).display !== 'none' : false,
          element: element,
        };
      });
      console.log('Tour steps debug:', stepDebug);

      // Verify at least one element exists
      const existingSteps = driverSteps.filter(step => {
        const element = document.querySelector(step.element);
        if (!element) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });

      if (existingSteps.length === 0) {
        console.error('No tour step elements found in DOM. Available elements:', {
          mainEditor: document.querySelector('[data-tour="main-editor"]'),
          allTourElements: document.querySelectorAll('[data-tour]'),
        });
        unlockMobileMenu();
        alert('Tour elements not found. Please refresh the page and try again.');
        return;
      }

      // Use only steps with existing elements
      const validSteps = driverSteps.filter(step => {
        const element = document.querySelector(step.element);
        if (!element) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });

      console.log(`Using ${validSteps.length} valid tour steps out of ${driverSteps.length} total`);

      // Inject custom styles
      injectTourStyles(resolvedTheme === 'dark');

      // Configure Driver.js
      const config = getTourConfig(resolvedTheme === 'dark');
      
      // Track if tour was completed
      let tourCompleted = false;
      
      // Wait a bit to ensure DOM is ready and scroll to top
      await new Promise(resolve => setTimeout(resolve, 300));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Create Driver instance with config
      const driverObj = driver({
        ...config,
        steps: validSteps,
        onHighlightStarted: (element: Element | undefined, step: any, options: any) => {
          // Call step's onHighlightStarted if provided
          const stepIndex = validSteps.findIndex(s => s.element === step.element);
          if (stepIndex >= 0 && stepIndex < filteredSteps.length) {
            const originalStep = filteredSteps[stepIndex];
            originalStep.onHighlightStarted?.();
          }
        },
        onDestroyStarted: () => {
          // Mark tour as completed if we finished all steps
          if (tourCompleted) {
            localStorage.setItem(TOUR_STORAGE_KEYS.completed, 'true');
            localStorage.setItem(TOUR_STORAGE_KEYS.device, isMobile ? 'mobile' : 'desktop');
            localStorage.setItem(TOUR_STORAGE_KEYS.version, TOUR_VERSION);
            // Also remove skipped flag if it exists
            localStorage.removeItem(TOUR_STORAGE_KEYS.skipped);
          } else {
            localStorage.setItem(TOUR_STORAGE_KEYS.skipped, 'true');
          }
        },
        onDestroyed: () => {
          setIsTourActive(false);
          unlockMobileMenu();
          driverRef.current = null;
        },
        onHighlighted: (element: Element | undefined, step: any) => {
          // Track when we're on the last step
          const currentIndex = validSteps.findIndex(s => s.element === step.element);
          if (currentIndex === validSteps.length - 1) {
            tourCompleted = true;
          }
        },
        onNextClick: (element: Element | undefined, step: any, opts: any) => {
          // If this is the last step, mark as completed and close the tour
          const currentIndex = validSteps.findIndex(s => s.element === step.element);
          
          if (currentIndex === validSteps.length - 1) {
            tourCompleted = true;
            // Save completion immediately
            localStorage.setItem(TOUR_STORAGE_KEYS.completed, 'true');
            localStorage.setItem(TOUR_STORAGE_KEYS.device, isMobile ? 'mobile' : 'desktop');
            localStorage.setItem(TOUR_STORAGE_KEYS.version, TOUR_VERSION);
            localStorage.removeItem(TOUR_STORAGE_KEYS.skipped);
            // Explicitly close the tour when "Got it" is clicked on the last step
            if (driverRef.current) {
              (driverRef.current as any).destroy();
            }
            return;
          }
          
          // For non-last steps, explicitly trigger navigation
          // Driver.js requires explicit navigation when onNextClick callback is defined
          if (driverRef.current) {
            (driverRef.current as any).moveNext();
          }
        },
        onPrevClick: (element: Element | undefined, step: any, opts: any) => {
          // Explicitly trigger previous step navigation
          // Driver.js requires explicit navigation when onPrevClick callback is defined
          if (driverRef.current) {
            (driverRef.current as any).movePrevious();
          }
        },
        onCloseClick: (element: Element | undefined, step: any, opts: any) => {
          // Handle close button click
          tourCompleted = false;
          if (driverRef.current) {
            (driverRef.current as any).destroy();
          }
        },
      });

      driverRef.current = driverObj;
      setIsTourActive(true);

      // Start the tour
      driverObj.drive();

    } catch (error) {
      console.error('Failed to start tour:', error);
      unlockMobileMenu();
    }
  }, [user, resolvedTheme, closeMobileMenu, lockMobileMenu, unlockMobileMenu]);

  /**
   * Stop the tour
   */
  const stopTour = useCallback(() => {
    if (driverRef.current) {
      try {
        (driverRef.current as any).destroy();
      } catch (error) {
        console.error('Error stopping tour:', error);
      }
      driverRef.current = null;
      setIsTourActive(false);
      unlockMobileMenu();
    }
  }, [unlockMobileMenu]);

  /**
   * Check if tour is completed
   */
  const isTourCompleted = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(TOUR_STORAGE_KEYS.completed) === 'true';
  }, []);

  /**
   * Reset tour state (for testing or re-taking tour)
   */
  const resetTour = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOUR_STORAGE_KEYS.completed);
    localStorage.removeItem(TOUR_STORAGE_KEYS.skipped);
    localStorage.removeItem(TOUR_STORAGE_KEYS.device);
  }, []);

  // Handle mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle theme changes during tour
  useEffect(() => {
    if (isTourActive && driverRef.current) {
      injectTourStyles(resolvedTheme === 'dark');
    }
  }, [resolvedTheme, isTourActive]);

  // Handle window resize (mobile ↔ desktop)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      // If tour is active and device type changed, stop tour
      if (isTourActive && driverRef.current) {
        const wasMobile = localStorage.getItem(TOUR_STORAGE_KEYS.device) === 'mobile';
        const isNowMobile = isMobileDevice();
        
        if (wasMobile !== isNowMobile) {
          stopTour();
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isTourActive, stopTour]);

  // Auto-start tour on mount if conditions are met
  useEffect(() => {
    if (!mounted) return;

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (shouldShowTourAutomatically() && !isTourActive) {
        // Don't auto-start, wait for user to trigger
        // startTour();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [mounted, isTourActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        try {
          driverRef.current.destroy();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      unlockMobileMenu();
    };
  }, [unlockMobileMenu]);

  // Export tour control functions via window (for debugging and external triggers)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__pasteportalTour = {
        start: startTour,
        stop: stopTour,
        reset: resetTour,
        isCompleted: isTourCompleted,
        isActive: () => isTourActive,
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__pasteportalTour;
      }
    };
  }, [startTour, stopTour, resetTour, isTourCompleted, isTourActive]);

  // This component doesn't render anything visible
  return null;
}

/**
 * Hook to access tour controls
 */
export const useTour = () => {
  if (typeof window === 'undefined') {
    return {
      startTour: () => {},
      stopTour: () => {},
      resetTour: () => {},
      isTourCompleted: () => false,
      isTourActive: () => false,
    };
  }

  const tour = (window as any).__pasteportalTour;
  
  return {
    startTour: tour?.start || (() => {}),
    stopTour: tour?.stop || (() => {}),
    resetTour: tour?.reset || (() => {}),
    isTourCompleted: tour?.isCompleted || (() => false),
    isTourActive: tour?.isActive || (() => false),
  };
};

