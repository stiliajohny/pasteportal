'use client';

import { useTheme } from './ThemeProvider';

/**
 * Triple toggle component for switching between light, dark, and system themes
 * Follows Fitts's Law: large, easily clickable targets
 * Follows Hick's Law: clear, distinct options
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="relative inline-flex items-center rounded-full bg-surface-variant/50 p-0.5 border border-divider/50">
      {/* Theme option buttons */}
      <button
        onClick={() => setTheme('light')}
        className={`
          relative z-10 p-1.5 rounded-full text-xs transition-all duration-200
          ${theme === 'light'
            ? 'bg-neon-cyan/80 text-dark'
            : 'text-text-secondary/70 hover:text-text-secondary'
          }
        `}
        aria-label="Light theme"
        title="Light theme"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      </button>

      <button
        onClick={() => setTheme('dark')}
        className={`
          relative z-10 p-1.5 rounded-full text-xs transition-all duration-200
          ${theme === 'dark'
            ? 'bg-neon-magenta/80 text-white'
            : 'text-text-secondary/70 hover:text-text-secondary'
          }
        `}
        aria-label="Dark theme"
        title="Dark theme"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      </button>

      <button
        onClick={() => setTheme('system')}
        className={`
          relative z-10 p-1.5 rounded-full text-xs transition-all duration-200
          ${theme === 'system'
            ? 'bg-neon-teal/80 text-dark'
            : 'text-text-secondary/70 hover:text-text-secondary'
          }
        `}
        aria-label="System theme"
        title="System theme"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </button>
    </div>
  );
}
