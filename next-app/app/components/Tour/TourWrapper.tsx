'use client';

import dynamic from 'next/dynamic';

/**
 * Client Component wrapper for Tour component
 * Handles dynamic import with ssr: false since it's a client-only component
 */
const Tour = dynamic(() => import('./Tour'), {
  ssr: false,
  loading: () => null,
});

export default Tour;

