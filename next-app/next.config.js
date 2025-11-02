/** @type {import('next').NextConfig} */
// Only enable PWA in production or when explicitly enabled in development
const isProduction = process.env.NODE_ENV === 'production';
const isPWAEnabled = isProduction || process.env.ENABLE_PWA_DEV === 'true';

// Only load and configure next-pwa when actually enabled
// This prevents initialization in development watch mode when disabled
const withPWA = isPWAEnabled
  ? require('next-pwa')({
      dest: 'public',
      register: true,
      skipWaiting: true,
      // Exclude source maps and build files from service worker generation
      buildExcludes: [
        /app-build-manifest\.json$/,
        /react-loadable-manifest\.json$/,
        /build-manifest\.json$/,
        /\.map$/,
      ],
      // Explicit service worker filename
      sw: 'sw.js',
      // Disable in development to avoid multiple generation warnings
      disable: !isProduction && process.env.ENABLE_PWA_DEV !== 'true',
      // Runtime caching configuration
      runtimeCaching: [
        {
          urlPattern: /^https?.*/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'offlineCache',
            expiration: {
              maxEntries: 200,
              maxAgeSeconds: 86400, // 24 hours
            },
          },
        },
      ],
      // Suppress warnings in development
      mode: isProduction ? 'production' : 'development',
    })
  : (config) => config;

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  // Suppress webpack warnings for GenerateSW in development
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Suppress the GenerateSW multiple calls warning in development
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        /GenerateSW has been called multiple times/,
      ];
    }
    return config;
  },
};

module.exports = withPWA(nextConfig);
