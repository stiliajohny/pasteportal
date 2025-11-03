'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading Swagger UI...</p>
      </div>
    </div>
  ),
});

/**
 * Portal Docs - Interactive API Documentation
 * Fancy name for Swagger UI documentation
 * Accessible at /api/portal-docs
 */
export default function PortalDocsPage() {
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /**
     * Dynamically load Swagger UI CSS to avoid Turbopack parsing issues
     */
    const loadSwaggerCSS = () => {
      if (!document.querySelector('link[href*="swagger-ui"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css';
        document.head.appendChild(link);
      }
    };

    /**
     * Fetch OpenAPI specification from API route
     */
    const fetchSpec = async () => {
      try {
        loadSwaggerCSS();
        const response = await fetch('/api/openapi-spec');
        if (!response.ok) {
          throw new Error('Failed to fetch API specification');
        }
        const data = await response.json();
        setSpec(data);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load API documentation');
        setLoading(false);
      }
    };

    fetchSpec();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading Portal Docs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Error Loading Documentation</h1>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="sticky top-0 z-50 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🚀 Portal Docs</h1>
              <p className="text-indigo-100 text-sm mt-1">Interactive API Documentation</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-indigo-100">PastePortal API v1.0.0</p>
              <a
                href="/"
                className="text-xs text-indigo-200 hover:text-white underline mt-1 block"
              >
                ← Back to Home
              </a>
            </div>
          </div>
        </div>
      </div>
      <div className="swagger-ui-wrapper">
        <SwaggerUI spec={spec} />
      </div>
      <style jsx global>{`
        .swagger-ui-wrapper {
          padding: 20px;
        }
        .swagger-ui .topbar {
          display: none;
        }
        .swagger-ui .info {
          margin: 20px 0;
        }
      `}</style>
    </div>
  );
}

