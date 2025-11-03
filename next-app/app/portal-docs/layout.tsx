import { Metadata } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pasteportal.app';

export const metadata: Metadata = {
  title: 'API Documentation - PastePortal',
  description: 'Interactive API documentation for PastePortal. Explore endpoints, request/response formats, and authentication.',
  openGraph: {
    title: 'API Documentation - PastePortal',
    description: 'Interactive API documentation for PastePortal. Explore endpoints, request/response formats, and authentication.',
    url: `${baseUrl}/portal-docs`,
    type: 'website',
  },
  alternates: {
    canonical: `${baseUrl}/portal-docs`,
  },
};

export default function PortalDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

