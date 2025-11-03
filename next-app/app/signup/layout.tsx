import { Metadata } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pasteportal.app';

export const metadata: Metadata = {
  title: 'Sign Up - PastePortal',
  description: 'Create a free PastePortal account to share code snippets with syntax highlighting and manage your pastes.',
  openGraph: {
    title: 'Sign Up - PastePortal',
    description: 'Create a free PastePortal account to share code snippets with syntax highlighting and manage your pastes.',
    url: `${baseUrl}/signup`,
    type: 'website',
  },
  alternates: {
    canonical: `${baseUrl}/signup`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

