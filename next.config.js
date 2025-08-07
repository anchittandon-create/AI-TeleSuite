
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
  // Increase the default timeout for serverless functions (Vercel)
  // to handle long-running AI tasks like transcribing large audio files.
  // The default is often around 10-15 seconds. 120 seconds = 2 minutes.
  // Note: This is a Vercel-specific configuration. For other platforms,
  // you might need to configure timeouts differently.
  // We will add this setting directly to vercel.json for deployment.
  // For local development, this setting in next.config.js is not directly
  // used, but it's good practice to document the need for a longer timeout.
  // The actual timeout will be managed by the deployment environment.
};

module.exports = nextConfig;
