'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Privacy Policy page
 * Simple and clear privacy policy for PastePortal
 */
export default function PrivacyPage() {
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
        <h1 className="text-3xl md:text-4xl font-bold text-text mb-2">Privacy Policy</h1>
        <p className="text-text-secondary">Last updated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="prose prose-invert max-w-none space-y-6 text-text-secondary">
        <section>
          <h2 className="text-xl font-semibold text-text mb-3">1. Information We Collect</h2>
          <p className="mb-2">We collect the following types of information:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li><strong>Account Information:</strong> Email address, username, and profile information you provide</li>
            <li><strong>Content:</strong> Code snippets and text you share through our service</li>
            <li><strong>Usage Data:</strong> Information about how you interact with our service</li>
            <li><strong>Technical Data:</strong> IP address, browser type, and device information</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">2. How We Use Your Information</h2>
          <p className="mb-2">We use collected information to:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Provide, maintain, and improve our service</li>
            <li>Process your account registration and authentication</li>
            <li>Store and display your shared content</li>
            <li>Send you service-related notifications</li>
            <li>Monitor and analyze usage patterns</li>
            <li>Ensure security and prevent abuse</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">3. Data Storage and Security</h2>
          <p>
            Your data is stored securely using Supabase, which provides industry-standard security measures.
            We implement appropriate technical and organizational measures to protect your personal information
            against unauthorized access, alteration, disclosure, or destruction.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">4. Data Sharing</h2>
          <p>
            We do not sell, trade, or rent your personal information to third parties. We may share your information
            only in the following circumstances:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
            <li>With your explicit consent</li>
            <li>To comply with legal obligations</li>
            <li>To protect our rights and prevent fraud</li>
            <li>With service providers who assist in operating our service (under strict confidentiality agreements)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">5. Your Rights</h2>
          <p className="mb-2">You have the right to:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Access your personal information</li>
            <li>Correct inaccurate or incomplete information</li>
            <li>Delete your account and associated data</li>
            <li>Withdraw consent for data processing</li>
            <li>Request a copy of your data</li>
          </ul>
          <p className="mt-3">
            To exercise these rights, please contact us or use the account deletion feature in your settings.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">6. Cookies and Tracking</h2>
          <p>
            We use cookies and similar technologies to maintain your session, remember your preferences,
            and analyze service usage. You can control cookie settings through your browser, though this
            may affect service functionality.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">7. Third-Party Services</h2>
          <p>
            Our service integrates with third-party services (such as Supabase for authentication and storage).
            These services have their own privacy policies, and we encourage you to review them.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">8. Data Retention</h2>
          <p>
            We retain your personal information for as long as your account is active or as needed to provide
            our service. When you delete your account, we will delete or anonymize your personal information,
            except where we are required to retain it for legal purposes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">9. Children&apos;s Privacy</h2>
          <p>
            Our service is not intended for children under 13 years of age. We do not knowingly collect
            personal information from children. If you become aware that a child has provided us with
            personal information, please contact us immediately.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any material changes
            by posting the new policy on this page and updating the &quot;Last updated&quot; date. Your continued use
            of the service after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">11. Contact Us</h2>
          <p>
            If you have questions or concerns about this Privacy Policy or our data practices, please contact
            us through our GitHub repository or through the contact methods provided on our website.
          </p>
        </section>
      </div>
    </div>
  );
}

