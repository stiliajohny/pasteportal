import { MetadataRoute } from 'next';

/**
 * Generates the sitemap.xml for Google Search Console and other search engines.
 * This helps search engines discover and index all public pages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pasteportal.app';
  const currentDate = new Date();

  // Public pages that should be indexed
  // Order: Main page (highest priority), then login, then signup
  const publicPages = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
  ];

  return publicPages;
}

