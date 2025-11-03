import { Metadata } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pasteportal.app';

export const metadata: Metadata = {
  title: 'Login - PastePortal',
  description: 'Sign in to your PastePortal account to manage your pastes and access premium features.',
  openGraph: {
    title: 'Login - PastePortal',
    description: 'Sign in to your PastePortal account to manage your pastes and access premium features.',
    url: `${baseUrl}/login`,
    type: 'website',
  },
  alternates: {
    canonical: `${baseUrl}/login`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

