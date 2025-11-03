'use client';

import Link from 'next/link';
import TourTrigger from './Tour/TourTrigger';

/**
 * Footer component with links and branding
 * Follows Law of Common Region: groups related content
 * Mobile responsive with collapsible sections
 */
export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-divider bg-footer-background w-full overflow-x-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4 max-w-full">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-4 mb-3 md:mb-4">
          {/* Brand Section */}
          <div className="space-y-1 md:col-span-1">
            <h3 className="text-sm md:text-base font-bold bg-gradient-to-r from-neon-cyan to-neon-teal bg-clip-text text-transparent">
              PastePortal
            </h3>
            <p className="text-xs text-text-secondary leading-snug hidden md:block">
              Share code snippets with syntax highlighting. Quick, simple, and developer-friendly.
            </p>
          </div>

          {/* Group Quick Links, Legal, and About together with smaller gap */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-3 md:col-span-3">
            {/* Links Section */}
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-text uppercase tracking-wide hidden md:block">Quick Links</h4>
              <ul className="flex md:flex-col gap-3 md:gap-1.5">
                <li>
                  <Link
                    href="https://github.com/stiliajohny/pasteportal"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-text-secondary hover:text-neon-cyan transition-colors duration-200 flex items-center gap-1.5"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="hidden sm:inline">GitHub</span>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal Section */}
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-text uppercase tracking-wide">Legal</h4>
              <ul className="flex md:flex-col gap-3 md:gap-1.5">
                <li>
                  <Link
                    href="/terms"
                    className="text-xs text-text-secondary hover:text-neon-cyan transition-colors duration-200"
                  >
                    Terms and Conditions
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-xs text-text-secondary hover:text-neon-cyan transition-colors duration-200"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/security"
                    className="text-xs text-text-secondary hover:text-neon-magenta transition-colors duration-200"
                  >
                    Security
                  </Link>
                </li>
              </ul>
            </div>

            {/* About Section */}
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-text uppercase tracking-wide">About</h4>
              <p className="text-xs text-text-secondary leading-snug hidden md:block">
                A text sharing tool for developers. Share code snippets and context effortlessly with syntax highlighting.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-3 border-t border-divider">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <p className="text-xs text-text-secondary text-center sm:text-left">
              © {currentYear} PastePortal. Built with ❤️ for developers.
            </p>
            <div className="flex items-center gap-4">
              <TourTrigger />
              <span className="text-xs text-text-secondary hidden sm:inline">
                Made with Next.js
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
