'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Terms and Conditions page
 * Simple and clear terms for PastePortal
 */
export default function TermsPage() {
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
        <h1 className="text-3xl md:text-4xl font-bold text-text mb-2">Terms and Conditions</h1>
        <p className="text-text-secondary">Last updated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="prose prose-invert max-w-none space-y-6 text-text-secondary">
        <section>
          <h2 className="text-xl font-semibold text-text mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing and using PastePortal, you accept and agree to be bound by these Terms and Conditions.
            If you do not agree with any part of these terms, you must not use our service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">2. Service Description</h2>
          <p>
            PastePortal is a service that allows users to share code snippets and text with syntax highlighting.
            We provide a platform for developers to quickly share and view code snippets.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">3. User Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials.
            You agree to notify us immediately of any unauthorized use of your account.
            We reserve the right to suspend or terminate accounts that violate these terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">4. Acceptable Use</h2>
          <p className="mb-2">You agree not to:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Share illegal, harmful, or offensive content</li>
            <li>Violate any laws or regulations</li>
            <li>Infringe on intellectual property rights</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Use the service to distribute malware or spam</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">5. Content Ownership</h2>
          <p>
            You retain ownership of any content you share through PastePortal. By sharing content,
            you grant us a license to display, store, and distribute that content as necessary to provide our service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">6. Service Availability</h2>
          <p>
            We strive to provide reliable service, but we do not guarantee uninterrupted or error-free operation.
            We reserve the right to modify or discontinue the service at any time with or without notice.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">7. Limitation of Liability</h2>
          <p>
            PastePortal is provided "as is" without warranties of any kind. We are not liable for any
            damages arising from your use of the service, including but not limited to direct, indirect,
            incidental, or consequential damages.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">8. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms and Conditions at any time. Changes will be effective
            immediately upon posting. Your continued use of the service constitutes acceptance of the modified terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">9. Contact</h2>
          <p>
            If you have questions about these Terms and Conditions, please contact us through our
            GitHub repository or through the contact methods provided on our website.
          </p>
        </section>
      </div>
    </div>
  );
}

