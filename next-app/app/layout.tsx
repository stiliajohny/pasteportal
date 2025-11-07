import type { Metadata, Viewport } from 'next';
import { Source_Code_Pro } from 'next/font/google';
import 'prismjs/themes/prism-tomorrow.css';
import { Suspense } from 'react';
import Footer from './components/Footer';
import GoogleAnalytics from './components/GoogleAnalytics';
import Header from './components/Header';
import PWARegister from './components/PWARegister';
import { ThemeProvider } from './components/ThemeProvider';
import Tour from './components/Tour/Tour';
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
  alternates: {
    canonical: baseUrl,
  },
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
  // Google Search Console verification (set via environment variable)
  // Format: GOOGLE_VERIFICATION_TOKEN=your_verification_token
  ...(process.env.GOOGLE_VERIFICATION_TOKEN && {
    verification: {
      google: process.env.GOOGLE_VERIFICATION_TOKEN,
    },
  }),
  // Google AdSense account (set via environment variable)
  // Format: NEXT_PUBLIC_ADSENSE_ACCOUNT=ca-pub-xxxxxxxxxxxxxxx
  ...(process.env.NEXT_PUBLIC_ADSENSE_ACCOUNT && {
    other: {
      'google-adsense-account': process.env.NEXT_PUBLIC_ADSENSE_ACCOUNT,
    },
  }),
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
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pasteportal.app';
  const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  
  // Google Analytics Measurement ID (set via environment variable or use default)
  // Format: NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-4EQ3Y83TP7';
  
  // Validate AdSense client ID - must be in format ca-pub-xxxxxxxxxxxxxxx (16 digits)
  // Reject placeholder values like "ca-pub-your-adsense-client-id"
  const isValidAdSenseId = adsenseClientId && 
    /^ca-pub-[0-9]{16}$/.test(adsenseClientId) &&
    adsenseClientId !== 'ca-pub-your-adsense-client-id';
  
  // Structured data (JSON-LD) for better SEO
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'PastePortal',
    description: 'A modern text sharing tool for developers. Share code snippets with preserved syntax highlighting.',
    url: baseUrl,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    creator: {
      '@type': 'Organization',
      name: 'PastePortal',
    },
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google tag (gtag.js) */}
        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaMeasurementId}');
            `,
          }}
        />
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="canonical" href={baseUrl} />
        {isValidAdSenseId && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            crossOrigin="anonymous"
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className={`${sourceCodePro.variable} font-mono antialiased overflow-x-hidden`}>
        <ThemeProvider>
          <AuthProvider>
            <Suspense fallback={null}>
              <GoogleAnalytics />
            </Suspense>
            <PWARegister />
            <Tour />
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
