
/** @type {import('next').NextConfig} */
import createNextPwa from '@ducanh2912/next-pwa';

const withPWA = createNextPwa({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig = {
  // Your Next.js config options here
  webpack: (config, { isServer, dev }) => {
    // Exclude the custom server sw from the main app builds
    if (!isServer && !dev) {
        config.externals = {
            ...config.externals,
            './firebase/messaging-sw': 'self.firebase-messaging-sw.js',
        };
    }
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false, // This is to fix 'fs' module not found error in browser
    };
    return config;
  },
};

export default withPWA(nextConfig);
