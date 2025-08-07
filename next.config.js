
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
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
    serverActions: {
      bodySizeLimit: '100mb', // Increase body size limit for large file uploads
    },
  },
  // The Vercel-specific 'maxDuration' property should be configured in vercel.json
  // for deployments. This comment serves as a reminder.
  // For local development with 'next dev', timeouts are generally not an issue.
};

module.exports = nextConfig;
