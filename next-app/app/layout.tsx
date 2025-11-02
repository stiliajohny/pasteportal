import type { Metadata, Viewport } from 'next';
import { Source_Code_Pro } from 'next/font/google';
import Footer from './components/Footer';
import Header from './components/Header';
import PWARegister from './components/PWARegister';
import { ThemeProvider } from './components/ThemeProvider';
import { AuthProvider } from './contexts/AuthContext';
import './globals.css';

// Validate configuration on server-side startup
// This ensures the app fails fast if environment variables are missing or invalid
if (typeof window === 'undefined') {
  try {
    require('@/lib/config-validation').getValidatedConfig();
  } catch (error) {
    // Error is logged and thrown in config-validation.ts
    throw error;
  }
}

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '600', '700'],
});

// Base URL for social media meta tags
// Set NEXT_PUBLIC_SITE_URL environment variable in production (e.g., https://pasteportal.app)
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pasteportal.app';
// Social media preview image (different from the logo)
// Place your social sharing image at: next-app/public/og-image.png
const ogImageUrl = `${baseUrl}/og-image.png`;

export const metadata: Metadata = {
  title: 'PastePortal - Share Code with Syntax Highlighting',
  description: 'A modern text sharing tool for developers. Share code snippets with preserved syntax highlighting.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PastePortal',
  },
  openGraph: {
    title: 'PastePortal - Share Code with Syntax Highlighting',
    description: 'A modern text sharing tool for developers. Share code snippets with preserved syntax highlighting.',
    type: 'website',
    url: baseUrl,
    siteName: 'PastePortal',
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: 'PastePortal Logo',
      },
    ],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PastePortal - Share Code with Syntax Highlighting',
    description: 'A modern text sharing tool for developers. Share code snippets with preserved syntax highlighting.',
    images: [ogImageUrl],
    creator: '@pasteportal', // Update with your Twitter handle if you have one
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${sourceCodePro.variable} font-mono antialiased overflow-x-hidden`}>
        <ThemeProvider>
          <AuthProvider>
            <PWARegister />
            <div className="flex flex-col min-h-screen w-full overflow-x-hidden">
              <Header />
              <main className="flex-1 w-full overflow-x-hidden">
                {children}
              </main>
              <Footer />
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
