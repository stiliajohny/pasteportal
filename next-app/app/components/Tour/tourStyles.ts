/**
 * Custom Driver.js styling that matches PastePortal theme
 * Supports dark/light mode and responsive design
 */

/**
 * Get custom Driver.js configuration with PastePortal theme
 * @param isDarkMode - Whether dark mode is active
 * @returns Driver.js configuration object
 */
export const getTourConfig = (isDarkMode: boolean) => {
  const backgroundColor = isDarkMode ? '#0a0a0f' : '#ffffff';
  const borderColor = isDarkMode ? '#333333' : '#e0e0e0';

  return {
    overlayColor: '#000000',
    overlayOpacity: 0.6,
    stageBackground: backgroundColor,
    stageBorderColor: borderColor,
    stageRadius: 8,
    stagePadding: 4,
    allowClose: true,
    allowKeyboardControl: true,
    disableActiveInteraction: false,
    smoothScroll: true,
    animate: true,
    popoverClass: 'pasteportal-tour-popover',
    popoverOffset: 10,
    showButtons: ['next', 'previous', 'close'] as Array<'next' | 'previous' | 'close'>,
    showProgress: true,
    progressText: 'Step {{current}} of {{total}}',
    nextBtnText: 'Next →',
    prevBtnText: '← Previous',
    closeBtnText: 'Skip Tour',
    doneBtnText: 'Got it!',
  };
};

/**
 * Inject custom CSS for tour styling
 * This function adds styles that match PastePortal's neon theme
 */
export const injectTourStyles = (isDarkMode: boolean): void => {
  if (typeof document === 'undefined') return;

  const styleId = 'pasteportal-tour-styles';
  let styleElement = document.getElementById(styleId) as HTMLStyleElement;

  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  }

  const backgroundColor = isDarkMode ? '#0a0a0f' : '#ffffff';
  const surfaceColor = isDarkMode ? '#1a1a1f' : '#f5f5f5';
  const textColor = isDarkMode ? '#e0e0e0' : '#1a1a1a';
  const secondaryTextColor = isDarkMode ? '#a0a0a0' : '#666666';
  const borderColor = isDarkMode ? '#333333' : '#e0e0e0';
  const neonCyan = '#00d9ff';
  const neonMagenta = '#ff00ff';
  const neonTeal = '#00ffd9';

  styleElement.textContent = `
    /* Tour Popover Styling - Driver.js actual structure */
    .driver-popover {
      background: ${backgroundColor} !important;
      border: 1px solid ${borderColor} !important;
      border-radius: 12px !important;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
      max-width: 380px !important;
      min-width: 280px !important;
      font-family: var(--font-mono, 'Source Code Pro', monospace) !important;
      padding: 24px !important;
      margin: 16px !important;
      z-index: 999999 !important;
      position: fixed !important;
    }

    /* Mobile adjustments */
    @media (max-width: 767px) {
      .driver-popover {
        max-width: calc(100vw - 32px) !important;
        min-width: calc(100vw - 32px) !important;
        margin: 16px !important;
        padding: 20px !important;
      }
    }

    /* Popover header - position close button on the right */
    .driver-popover-header {
      position: relative !important;
      display: flex !important;
      align-items: flex-start !important;
      justify-content: space-between !important;
      margin-bottom: 12px !important;
      padding-right: 40px !important;
    }

    /* Popover title */
    .driver-popover-title {
      color: ${textColor} !important;
      font-size: 18px !important;
      font-weight: 700 !important;
      margin: 0 !important;
      padding: 0 !important;
      padding-right: 8px !important;
      line-height: 1.4 !important;
      flex: 1 !important;
    }

    /* Popover description */
    .driver-popover-description {
      color: ${secondaryTextColor} !important;
      font-size: 14px !important;
      line-height: 1.6 !important;
      margin: 0 0 20px 0 !important;
      padding: 0 !important;
    }

    /* Popover footer */
    .driver-popover-footer {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      padding: 0 !important;
      margin-top: 16px !important;
      border-top: 1px solid ${borderColor} !important;
      padding-top: 16px !important;
      gap: 8px !important;
      flex-wrap: wrap !important;
    }

    /* Progress indicator */
    .driver-popover-progress {
      color: ${secondaryTextColor} !important;
      font-size: 12px !important;
      margin-bottom: 12px !important;
      width: 100% !important;
      text-align: center !important;
    }

    /* Button container */
    .driver-popover-footer > div {
      display: flex !important;
      gap: 8px !important;
      width: 100% !important;
      justify-content: flex-end !important;
      flex-wrap: wrap !important;
    }

    /* All buttons in popover */
    .driver-popover button,
    .driver-popover-next-btn,
    .driver-popover-prev-btn,
    .driver-popover-close-btn {
      padding: 10px 20px !important;
      border-radius: 8px !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      font-family: var(--font-mono, 'Source Code Pro', monospace) !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      border: none !important;
      min-height: 40px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      pointer-events: auto !important;
      opacity: 1 !important;
      user-select: none !important;
    }

    /* Next/Done button */
    .driver-popover-next-btn,
    .driver-popover button:not(.driver-popover-prev-btn):not(.driver-popover-close-btn) {
      background: linear-gradient(135deg, ${neonCyan} 0%, ${neonMagenta} 100%) !important;
      color: #000000 !important;
    }

    .driver-popover-next-btn:hover:not(:disabled),
    .driver-popover button:not(.driver-popover-prev-btn):not(.driver-popover-close-btn):hover:not(:disabled) {
      opacity: 0.9 !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 4px 12px rgba(0, 217, 255, 0.3) !important;
    }

    /* Previous button */
    .driver-popover-prev-btn,
    .driver-popover button.driver-popover-prev-btn {
      background: ${surfaceColor} !important;
      color: ${textColor} !important;
      border: 1px solid ${borderColor} !important;
    }

    .driver-popover-prev-btn:hover:not(:disabled),
    .driver-popover button.driver-popover-prev-btn:hover:not(:disabled) {
      background: ${isDarkMode ? '#25252f' : '#eeeeee'} !important;
    }

    /* Close button (Skip Tour button) */
    .driver-popover-close-btn,
    .driver-popover button.driver-popover-close-btn {
      background: transparent !important;
      color: ${secondaryTextColor} !important;
      padding: 10px 16px !important;
      pointer-events: auto !important;
      cursor: pointer !important;
      z-index: 1000001 !important;
      position: relative !important;
    }

    .driver-popover-close-btn:hover:not(:disabled),
    .driver-popover button.driver-popover-close-btn:hover:not(:disabled) {
      color: ${textColor} !important;
      background: ${surfaceColor} !important;
    }

    /* Close icon (X button in top-right corner) - only within header */
    .driver-popover-header button {
      background: transparent !important;
      color: ${secondaryTextColor} !important;
      border: none !important;
      cursor: pointer !important;
      pointer-events: auto !important;
      opacity: 1 !important;
      z-index: 1000001 !important;
      position: absolute !important;
      top: 0 !important;
      right: 0 !important;
      left: auto !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 8px !important;
      min-width: 32px !important;
      min-height: 32px !important;
      width: 32px !important;
      height: 32px !important;
      border-radius: 4px !important;
      transition: all 0.2s ease !important;
      margin: 0 !important;
      margin-left: auto !important;
    }

    /* Generic close button styles (for buttons not in header) */
    .driver-popover-close-icon,
    .driver-close-btn,
    button.driver-close-btn {
      background: transparent !important;
      color: ${secondaryTextColor} !important;
      border: none !important;
      cursor: pointer !important;
      pointer-events: auto !important;
      opacity: 1 !important;
      z-index: 1000001 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 8px !important;
      min-width: 32px !important;
      min-height: 32px !important;
      border-radius: 4px !important;
      transition: all 0.2s ease !important;
    }

    .driver-popover-close-icon:hover,
    .driver-close-btn:hover,
    button.driver-close-btn:hover,
    .driver-popover-header button:hover {
      color: ${textColor} !important;
      background: ${surfaceColor} !important;
      opacity: 1 !important;
    }

    /* Disabled buttons */
    .driver-popover button:disabled,
    .driver-popover-btn-disabled {
      opacity: 0.5 !important;
      cursor: not-allowed !important;
      pointer-events: none !important;
    }

    /* Ensure enabled buttons are clickable */
    .driver-popover button:not(:disabled):not(.driver-popover-btn-disabled) {
      pointer-events: auto !important;
      cursor: pointer !important;
    }

    /* Overlay styling - ensure it covers everything */
    .driver-overlay,
    .driver-overlay-no-highlight {
      background: ${isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.6)'} !important;
      backdrop-filter: blur(1px) !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 999997 !important;
      pointer-events: auto !important;
    }

    /* Ensure popover and buttons are above overlay and clickable */
    .driver-popover * {
      pointer-events: auto !important;
      z-index: inherit !important;
    }

    /* Ensure all close-related elements are clickable and positioned on the right */
    .driver-popover [class*="close"],
    .driver-popover button[class*="close"],
    .driver-popover [aria-label*="close" i],
    .driver-popover [aria-label*="Close" i] {
      pointer-events: auto !important;
      cursor: pointer !important;
      z-index: 1000001 !important;
      position: absolute !important;
      top: 12px !important;
      right: 12px !important;
      left: auto !important;
    }

    /* Ensure popover header and footer are clickable */
    .driver-popover-header,
    .driver-popover-footer {
      pointer-events: auto !important;
      z-index: inherit !important;
    }

    /* Ensure all buttons in footer are clickable */
    .driver-popover-footer button,
    .driver-popover-footer * {
      pointer-events: auto !important;
      cursor: pointer !important;
    }

    /* Driver stage (highlighted area) */
    .driver-stage {
      background: transparent !important;
      border: 3px solid ${neonCyan} !important;
      border-radius: 8px !important;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6), 0 0 20px ${neonCyan}80 !important;
      z-index: 999998 !important;
    }

    /* Highlighted element */
    .driver-highlighted-element {
      border-radius: 8px !important;
      position: relative !important;
      z-index: 999998 !important;
    }

    /* Accessibility - Focus states */
    .pasteportal-tour-popover__button:focus-visible {
      outline: 2px solid ${neonCyan} !important;
      outline-offset: 2px !important;
    }

    /* Ensure popover is above all other content */
    .driver-popover {
      z-index: 999999 !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      position: fixed !important;
      pointer-events: auto !important;
    }

    /* Position close button in top-right of popover if it's a direct child */
    .driver-popover > button[class*="close"],
    .driver-popover > .driver-close-btn,
    .driver-popover > button[aria-label*="close" i],
    .driver-popover button[aria-label*="close" i] {
      position: absolute !important;
      top: 12px !important;
      right: 12px !important;
      left: auto !important;
      z-index: 1000002 !important;
      margin-left: auto !important;
    }

    /* Ensure popover content area allows interactions */
    .driver-popover-content,
    .driver-popover-wrapper,
    .driver-popover-body {
      pointer-events: auto !important;
    }

    /* Popover wrapper/content - don't override positioning */
    .driver-popover-wrapper {
      padding: 0 !important;
    }
  `;
};

