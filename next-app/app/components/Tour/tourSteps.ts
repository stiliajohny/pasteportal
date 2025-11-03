/**
 * Tour step definitions for desktop and mobile
 * Includes selectors, messages, positioning, and conditional logic
 */

import { type driver } from 'driver.js';

export type TourStep = {
  element: string;
  popover: {
    title: string;
    description: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    side?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    align?: 'start' | 'center' | 'end';
  };
  onHighlightStarted?: () => void;
  requiresAuth?: boolean;
  requiresText?: boolean;
  conditional?: () => boolean;
};

/**
 * Desktop tour steps (8 steps)
 */
export const desktopTourSteps: TourStep[] = [
  {
    element: '[data-tour="main-editor"]',
    popover: {
      title: 'Welcome to PastePortal! 🎉',
      description:
        'This is where you paste or type your code. PastePortal automatically detects syntax and highlights your code beautifully.',
      position: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="push-button"]',
    popover: {
      title: 'Push to Share',
      description:
        'Click "Push" to save your paste and get a shareable link instantly. Share it with anyone, anywhere!',
      position: 'bottom',
      align: 'center',
    },
    requiresText: true,
  },
  {
    element: '[data-tour="push-encrypt"]',
    popover: {
      title: 'Secure Your Paste',
      description:
        'Click the arrow next to Push to encrypt your paste with a password. Perfect for sensitive code or private information.',
      position: 'bottom',
      align: 'end',
    },
    requiresText: true,
    conditional: () => {
      // Only show if encryption button is visible
      const element = document.querySelector('[data-tour="push-encrypt"]');
      return element !== null && window.getComputedStyle(element as Element).display !== 'none';
    },
  },
  {
    element: '[data-tour="paste-id-input"]',
    popover: {
      title: 'Retrieve Pastes',
      description:
        'Enter a paste ID here and click "Pull" to view shared pastes. Great for viewing code shared by others!',
      position: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="language-selector"]',
    popover: {
      title: 'Syntax Highlighting',
      description:
        'Choose the programming language for syntax highlighting. PastePortal auto-detects, but you can override it here.',
      position: 'bottom',
      align: 'end',
    },
    requiresText: true,
    conditional: () => {
      const element = document.querySelector('[data-tour="language-selector"]');
      return element !== null && window.getComputedStyle(element as Element).display !== 'none';
    },
  },
  {
    element: '[data-tour="edit-view-toggle"]',
    popover: {
      title: 'Edit vs View Mode',
      description:
        'Switch between Edit mode (plain text editing) and View mode (syntax highlighted preview). Toggle anytime!',
      position: 'bottom',
      align: 'end',
    },
    conditional: () => {
      const element = document.querySelector('[data-tour="edit-view-toggle"]');
      return element !== null && window.getComputedStyle(element as Element).display !== 'none';
    },
  },
  {
    element: '[data-tour="upload-button"]',
    popover: {
      title: 'Quick Actions',
      description:
        'Upload files, download your paste, or copy to clipboard with one click. All your utility actions are here!',
      position: 'bottom',
      align: 'start',
    },
    requiresText: true,
  },
  {
    element: '[data-tour="sign-in-button"]',
    popover: {
      title: 'Get More Features',
      description:
        'Sign up to name your pastes, access them later, and unlock additional features. Also check out our upcoming IDE extensions!',
      position: 'bottom',
      align: 'end',
    },
    conditional: () => {
      // Only show if user is not authenticated
      const element = document.querySelector('[data-tour="sign-in-button"]');
      return element !== null && window.getComputedStyle(element as Element).display !== 'none';
    },
  },
];

/**
 * Mobile tour steps (5-6 steps, condensed)
 */
export const mobileTourSteps: TourStep[] = [
  {
    element: '[data-tour="main-editor"]',
    popover: {
      title: 'Welcome to PastePortal! 🎉',
      description:
        'Paste or type your code here. Syntax highlighting is automatic and beautiful.',
      position: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="push-button"]',
    popover: {
      title: 'Push to Share',
      description:
        'Tap "Push" to save and share your paste. Tap the arrow for encryption options to secure sensitive code.',
      position: 'bottom',
      align: 'center',
    },
    requiresText: true,
  },
  {
    element: '[data-tour="paste-id-input"]',
    popover: {
      title: 'Retrieve Pastes',
      description:
        'Enter a paste ID to view shared pastes. Perfect for viewing code from your team or community!',
      position: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="mobile-menu-button"]',
    popover: {
      title: 'Navigation & More',
      description:
        'Tap the menu icon to access Sign In, Settings, and all features. Your gateway to everything PastePortal offers!',
      position: 'bottom',
      align: 'center',
    },
    onHighlightStarted: () => {
      // Ensure mobile menu is closed before highlighting
      const menuButton = document.querySelector('[aria-label="Toggle mobile menu"]') as HTMLButtonElement;
      const menuPanel = document.querySelector('[data-tour="mobile-menu-panel"]');
      if (menuPanel && menuPanel.classList.contains('mobile-menu-open')) {
        menuButton?.click();
      }
    },
  },
  {
    element: '[data-tour="language-selector"]',
    popover: {
      title: 'Language & Modes',
      description:
        'Choose syntax highlighting language or switch between Edit and View modes. Everything in one place!',
      position: 'bottom',
      align: 'end',
    },
    requiresText: true,
    conditional: () => {
      const element = document.querySelector('[data-tour="language-selector"]');
      return element !== null && window.getComputedStyle(element as Element).display !== 'none';
    },
  },
];

/**
 * Filter tour steps based on conditions
 * @param steps - Array of tour steps to filter
 * @param options - Filtering options
 * @returns Filtered array of tour steps
 */
export const filterTourSteps = (
  steps: TourStep[],
  options: {
    isAuthenticated: boolean;
    hasText: boolean;
  }
): TourStep[] => {
  return steps.filter((step) => {
    // Check authentication requirement
    if (step.requiresAuth && !options.isAuthenticated) {
      return false;
    }

    // Check text requirement
    if (step.requiresText && !options.hasText) {
      return false;
    }

    // Check custom conditional
    if (step.conditional && !step.conditional()) {
      return false;
    }

    // Check if element exists in DOM
    const element = document.querySelector(step.element);
    if (!element) {
      return false;
    }

    // Check if element is visible
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    return true;
  });
};

/**
 * Convert TourStep array to Driver.js steps format
 * @param steps - Array of TourStep objects
 * @returns Driver.js steps configuration
 */
export const convertToDriverSteps = (steps: TourStep[]): any[] => {
  return steps.map((step) => {
    const driverStep: any = {
      element: step.element,
      popover: {
        title: step.popover.title,
        description: step.popover.description,
        position: step.popover.position || 'bottom',
        side: step.popover.side || step.popover.position || 'bottom',
        align: step.popover.align || 'center',
      },
    };

    // Add onHighlightStarted callback if provided
    if (step.onHighlightStarted) {
      driverStep.onHighlightStarted = step.onHighlightStarted;
    }

    return driverStep;
  });
};

