'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * Security page
 * Highlights security practices and improvements for PastePortal
 */
export default function SecurityPage() {
  const router = useRouter();

  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="text-text-secondary hover:text-text transition-colors mb-4 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-3xl md:text-4xl font-bold text-text mb-2 flex items-center gap-3">
          <svg className="w-8 h-8 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Security
        </h1>
        <p className="text-text-secondary">Comprehensive security practices and protections</p>
      </div>

      <div className="space-y-8 text-text-secondary">
        {/* Introduction */}
        <section className="bg-surface border border-divider rounded-lg p-6">
          <p className="text-base leading-relaxed">
            Security is a top priority at PastePortal. We implement multiple layers of protection to ensure
            your data remains safe and private. This page outlines our security practices, recent improvements,
            and how to report security vulnerabilities.
          </p>
        </section>

        {/* Core Security Features */}
        <section>
          <h2 className="text-2xl font-semibold text-text mb-4 flex items-center gap-2">
            <span className="text-neon-cyan">✓</span>
            Core Security Features
          </h2>
          <div className="space-y-4">
            <div className="bg-surface border border-divider rounded-lg p-5">
              <h3 className="text-xl font-semibold text-text mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-neon-magenta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Strong Encryption
              </h3>
              <p className="mb-2">
                All paste content is encrypted using <strong className="text-text">AES-256-GCM</strong> before storing in the database.
                This industry-standard encryption ensures your data remains secure even if database access is compromised.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                <li>AES-256-GCM provides authenticated encryption with associated data</li>
                <li>Encryption keys are stored securely in environment variables, never exposed to clients</li>
                <li>Each encrypted paste uses a unique initialization vector (IV) for maximum security</li>
              </ul>
            </div>

            <div className="bg-surface border border-divider rounded-lg p-5">
              <h3 className="text-xl font-semibold text-text mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-neon-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Password-Protected Pastes
              </h3>
              <p className="mb-2">
                Enhanced password encryption with <strong className="text-text">unique random salts</strong> per encryption.
                Each password-protected paste uses a cryptographically secure random salt, preventing rainbow table attacks.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                <li>PBKDF2 key derivation with 100,000 iterations</li>
                <li>Unique random salt for each encryption operation</li>
                <li>Backward compatible with existing encrypted pastes</li>
                <li>Client-side encryption ensures your password never leaves your device</li>
              </ul>
            </div>

            <div className="bg-surface border border-divider rounded-lg p-5">
              <h3 className="text-xl font-semibold text-text mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Database Security
              </h3>
              <p className="mb-2">
                Row Level Security (RLS) policies enforce access controls at the database level, ensuring users can only
                access their own data.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                <li>RLS policies prevent unauthorized data access</li>
                <li>User ID verification prevents user_id spoofing attacks</li>
                <li>Password fields are excluded from public API responses</li>
                <li>Authentication checks validate user identity before allowing operations</li>
              </ul>
            </div>

            <div className="bg-surface border border-divider rounded-lg p-5">
              <h3 className="text-xl font-semibold text-text mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-neon-magenta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Input Validation & Sanitization
              </h3>
              <p className="mb-2">
                Comprehensive input validation prevents injection attacks and ensures data integrity.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                <li>Paste ID format validation (UUID v4 or legacy hex)</li>
                <li>Paste size limits (400KB maximum) prevent resource exhaustion</li>
                <li>Password validation enforces security requirements</li>
                <li>Error messages are sanitized to prevent information disclosure</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Recent Security Improvements */}
        <section>
          <h2 className="text-2xl font-semibold text-text mb-4 flex items-center gap-2">
            <span className="text-neon-cyan">🔒</span>
            Recent Security Improvements
          </h2>
          <div className="bg-surface border border-divider rounded-lg p-5 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Content Security Policy (CSP)</h3>
              <p className="text-sm mb-2">
                Implemented strict CSP headers to prevent XSS attacks and code injection. The policy restricts
                resource loading to trusted sources only.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-text-secondary">
                <li>Script sources restricted to self and trusted domains</li>
                <li>Style sources limited to necessary origins</li>
                <li>Upgrade insecure requests forces HTTPS</li>
                <li>Frame ancestors blocked to prevent clickjacking</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text mb-2">CSRF Protection</h3>
              <p className="text-sm mb-2">
                Added comprehensive CSRF (Cross-Site Request Forgery) protection for all state-changing operations.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-text-secondary">
                <li>Origin header validation for all authenticated requests</li>
                <li>CSRF token validation using double-submit cookie pattern</li>
                <li>Protection for POST, DELETE, and other state-changing operations</li>
                <li>Maintains backward compatibility with API clients</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text mb-2">HSTS (HTTP Strict Transport Security)</h3>
              <p className="text-sm mb-2">
                Enforced HTTPS-only connections with HSTS headers to prevent protocol downgrade attacks.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-text-secondary">
                <li>1-year HSTS enforcement with subdomain coverage</li>
                <li>Preload list eligibility for maximum security</li>
                <li>Prevents man-in-the-middle attacks via HTTP</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Error Message Sanitization</h3>
              <p className="text-sm mb-2">
                Implemented production-safe error handling that prevents information disclosure.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-text-secondary">
                <li>Generic error messages returned to clients in production</li>
                <li>Detailed errors logged server-side only for debugging</li>
                <li>Prevents leakage of internal application structure</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Response Data Minimization</h3>
              <p className="text-sm mb-2">
                Removed unnecessary data from API responses to minimize exposure risks.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-text-secondary">
                <li>Paste content no longer returned in store-paste responses</li>
                <li>Only essential metadata (ID, timestamp) returned</li>
                <li>Reduces risk of interception or logging sensitive data</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Security Headers */}
        <section>
          <h2 className="text-2xl font-semibold text-text mb-4 flex items-center gap-2">
            <span className="text-neon-teal">🛡️</span>
            Security Headers
          </h2>
          <div className="bg-surface border border-divider rounded-lg p-5">
            <p className="mb-4">
              We implement comprehensive security headers to protect against various attack vectors:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-text mb-2">X-Frame-Options</h4>
                <p className="text-sm">DENY - Prevents clickjacking attacks</p>
              </div>
              <div>
                <h4 className="font-semibold text-text mb-2">X-XSS-Protection</h4>
                <p className="text-sm">1; mode=block - Enables XSS filtering</p>
              </div>
              <div>
                <h4 className="font-semibold text-text mb-2">X-Content-Type-Options</h4>
                <p className="text-sm">nosniff - Prevents MIME type sniffing</p>
              </div>
              <div>
                <h4 className="font-semibold text-text mb-2">Referrer-Policy</h4>
                <p className="text-sm">strict-origin-when-cross-origin - Controls referrer information</p>
              </div>
              <div>
                <h4 className="font-semibold text-text mb-2">Strict-Transport-Security</h4>
                <p className="text-sm">Enforces HTTPS-only connections</p>
              </div>
              <div>
                <h4 className="font-semibold text-text mb-2">Content-Security-Policy</h4>
                <p className="text-sm">Strict policy to prevent XSS and injection</p>
              </div>
            </div>
          </div>
        </section>

        {/* Best Practices */}
        <section>
          <h2 className="text-2xl font-semibold text-text mb-4 flex items-center gap-2">
            <span className="text-neon-cyan">💡</span>
            Security Best Practices for Users
          </h2>
          <div className="bg-surface border border-divider rounded-lg p-5 space-y-3">
            <div>
              <h3 className="font-semibold text-text mb-1">For Password-Protected Pastes:</h3>
              <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                <li>Use strong, unique passwords (8-30 characters, no spaces)</li>
                <li>Share passwords through secure channels</li>
                <li>Remember: we cannot recover passwords if lost</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-text mb-1">For Account Security:</h3>
              <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                <li>Keep your account credentials secure</li>
                <li>Use strong, unique passwords for your account</li>
                <li>Enable two-factor authentication if available</li>
                <li>Regularly review your pastes and delete unused ones</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-text mb-1">For Sharing Pastes:</h3>
              <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                <li>Be mindful of what content you share publicly</li>
                <li>Use password protection for sensitive information</li>
                <li>Remember: public pastes can be accessed by anyone with the link</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Reporting Security Issues */}
        <section>
          <h2 className="text-2xl font-semibold text-text mb-4 flex items-center gap-2">
            <span className="text-neon-magenta">🚨</span>
            Reporting Security Vulnerabilities
          </h2>
          <div className="bg-neon-magenta/10 border-2 border-neon-magenta/30 rounded-lg p-6">
            <p className="mb-4 text-text">
              We take security seriously and appreciate your help in keeping PastePortal secure.
              If you discover a security vulnerability, please report it responsibly.
            </p>
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-text mb-2">How to Report:</h3>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>
                    <strong className="text-text">Create a GitHub Issue</strong> on our repository at{' '}
                    <Link 
                      href="https://github.com/stiliajohny/pasteportal/issues" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-neon-cyan hover:underline"
                    >
                      github.com/stiliajohny/pasteportal/issues
                    </Link>
                  </li>
                  <li>
                    Use the <strong className="text-text">&quot;Security&quot;</strong> label when creating the issue
                  </li>
                  <li>
                    Provide a <strong className="text-text">&quot;clear description&quot;</strong> of the vulnerability
                  </li>
                  <li>
                    Include <strong className="text-text">&quot;steps to reproduce&quot;</strong> if possible
                  </li>
                  <li>
                    Do <strong className="text-text">not</strong> publicly disclose the vulnerability until it&apos;s been addressed
                  </li>
                </ol>
              </div>
              <div className="mt-4 p-4 bg-background rounded border border-divider">
                <p className="text-sm text-text-secondary mb-2">
                  <strong className="text-text">Important:</strong> Please allow us reasonable time to address
                  the vulnerability before public disclosure. We appreciate responsible disclosure practices.
                </p>
                <p className="text-sm text-text-secondary">
                  We will acknowledge your report and work to address it as quickly as possible. Thank you for
                  helping keep PastePortal secure!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Compliance & Standards */}
        <section>
          <h2 className="text-2xl font-semibold text-text mb-4 flex items-center gap-2">
            <span className="text-neon-teal">✅</span>
            Security Standards & Compliance
          </h2>
          <div className="bg-surface border border-divider rounded-lg p-5">
            <p className="mb-4">
              Our security practices align with industry standards and best practices:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                <strong className="text-text">OWASP Top 10</strong> - Protection against common web vulnerabilities
              </li>
              <li>
                <strong className="text-text">NIST Guidelines</strong> - Following encryption and key management best practices
              </li>
              <li>
                <strong className="text-text">HTTPS Everywhere</strong> - All connections encrypted with TLS
              </li>
              <li>
                <strong className="text-text">Defense in Depth</strong> - Multiple layers of security controls
              </li>
            </ul>
          </div>
        </section>

        {/* Last Updated */}
        <section className="text-center text-sm text-text-secondary pt-4 border-t border-divider">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          <p className="mt-2">
            Security is an ongoing process. We continuously improve our security measures to protect your data.
          </p>
        </section>
      </div>
    </div>
  );
}

