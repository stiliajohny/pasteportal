import { Metadata } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pasteportal.app';

export const metadata: Metadata = {
  title: 'Terms and Conditions - PastePortal',
  description: 'Terms and Conditions for using PastePortal service.',
  openGraph: {
    title: 'Terms and Conditions - PastePortal',
    description: 'Terms and Conditions for using PastePortal service.',
    url: `${baseUrl}/terms`,
    type: 'website',
  },
  alternates: {
    canonical: `${baseUrl}/terms`,
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

