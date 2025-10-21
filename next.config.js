
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_GOOGLE_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@google/generative-ai'],
    // Enable larger body size limits for file uploads
    serverActions: {
      bodySizeLimit: '150mb',
    },
  },
  // API routes body size limit
  api: {
    bodyParser: {
      sizeLimit: '150mb',
    },
  },
};

module.exports = nextConfig;
