/** @type {import('next').NextConfig} */
import withPWA from '@ducanh2912/next-pwa';

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // Other PWA options
});

const nextConfig = {
  // Your regular Next.js config
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '**',
      },
       {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        port: '',
        pathname: '**',
      },
    ],
  },
  webpack: (config, { isServer, dev }) => {
    if (isServer) {
      // (server-side-only compilation)
    }

    if (!isServer) {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            //This is required for genkit to work.
            "http": false,
            "https": false,
            "url": false,
            "zlib": false,
            "net": false,
            "tls": false,
            "fs": false,
        };
    }
    
    // Compile the service worker
    if (!dev && !isServer) {
        config.entry.sw = ['./src/lib/firebase/messaging-sw.ts'];
    }

    return config;
  },
};

export default pwaConfig(nextConfig);
