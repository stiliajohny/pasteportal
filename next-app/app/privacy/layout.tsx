import { Metadata } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pasteportal.app';

export const metadata: Metadata = {
  title: 'Privacy Policy - PastePortal',
  description: 'Privacy Policy for PastePortal. Learn how we collect, use, and protect your data.',
  openGraph: {
    title: 'Privacy Policy - PastePortal',
    description: 'Privacy Policy for PastePortal. Learn how we collect, use, and protect your data.',
    url: `${baseUrl}/privacy`,
    type: 'website',
  },
  alternates: {
    canonical: `${baseUrl}/privacy`,
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

