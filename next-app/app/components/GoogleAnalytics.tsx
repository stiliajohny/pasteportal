'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * GoogleAnalytics component
 * Tracks pageviews automatically when route changes in Next.js App Router
 * Uses usePathname and useSearchParams to detect route changes
 */
export default function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Only track if gtag is available (client-side only)
    if (typeof window === 'undefined' || !window.gtag) {
      return;
    }

    // Get the current URL including search params
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');

    // Track pageview
    window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-4EQ3Y83TP7', {
      page_path: url,
    });
  }, [pathname, searchParams]);

  // This component doesn't render anything
  return null;
}

