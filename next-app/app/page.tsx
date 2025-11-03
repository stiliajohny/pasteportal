import PasteViewer from './components/PasteViewer';
import { Metadata } from 'next';
import { getPasteMetadata } from '@/lib/paste-metadata';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pasteportal.app';
const ogImageUrl = `${baseUrl}/og-image.png`;

export async function generateMetadata(props: {
  searchParams: Promise<{ id?: string }>;
}): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const pasteId = searchParams?.id;

  // Default metadata
  const defaultMetadata: Metadata = {
    title: 'PastePortal - Share Code with Syntax Highlighting',
    description: 'A modern text sharing tool for developers. Share code snippets with preserved syntax highlighting.',
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
      creator: '@pasteportal',
    },
  };

  // If no paste ID, return default metadata
  if (!pasteId) {
    return defaultMetadata;
  }

  // Fetch paste metadata
  const pasteMetadata = await getPasteMetadata(pasteId);

  if (!pasteMetadata) {
    return defaultMetadata;
  }

  // Generate dynamic metadata with paste name
  const pasteTitle = pasteMetadata.name || 'Untitled Paste';
  const pasteUrl = `${baseUrl}?id=${pasteId}`;
  const description = pasteMetadata.name
    ? `View this paste on PastePortal: ${pasteMetadata.name}`
    : 'View this paste on PastePortal';

  return {
    title: `${pasteTitle} - PastePortal`,
    description,
    openGraph: {
      title: pasteTitle,
      description,
      type: 'website',
      url: pasteUrl,
      siteName: 'PastePortal',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: pasteTitle,
        },
      ],
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: pasteTitle,
      description,
      images: [ogImageUrl],
      creator: '@pasteportal',
    },
  };
}

export default function Home() {
  // PasteViewer handles URL params client-side
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PasteViewer />
    </div>
  );
}
