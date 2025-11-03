import { Metadata } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pasteportal.app';

export const metadata: Metadata = {
  title: 'Security - PastePortal',
  description: 'Comprehensive security practices and protections implemented by PastePortal to keep your data safe.',
  openGraph: {
    title: 'Security - PastePortal',
    description: 'Comprehensive security practices and protections implemented by PastePortal to keep your data safe.',
    url: `${baseUrl}/security`,
    type: 'website',
  },
  alternates: {
    canonical: `${baseUrl}/security`,
  },
};

export default function SecurityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

