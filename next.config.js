
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
  // For Vercel deployments, the maxDuration can be configured in vercel.json.
  // For local development with 'next dev', timeouts are less of an issue.
  // This value is more for documentation and to guide production setup.
  // A higher value like 240 (4 minutes) is recommended for production.
  // maxDuration: 240,
};

module.exports = nextConfig;
