import path from 'path';
import { fileURLToPath } from 'url';
import WithPWA from '@ducanh2912/next-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 在這裡設定 Service Worker 的進入點
      config.entry['firebase-messaging-sw'] = path.join(
        __dirname,
        'src',
        'lib',
        'firebase',
        'messaging-sw.ts'
      );
    }
    return config;
  },
};

export default WithPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // runtimeCaching: [], // 您可以根據需要自訂快取策略
})(nextConfig);
