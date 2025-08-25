

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
      bodySizeLimit: '150mb', // Increase body size limit to safely handle 100MB files after Base64 encoding
    },
  },
  env: {
    NEXT_PUBLIC_GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  },
  // For Vercel deployments, the maxDuration can be configured in vercel.json,
  // or by exporting 'maxDuration' from the page itself.
  // The value below is for documentation. We export the constant from the page files.
  // maxDuration: 300,
};

module.exports = nextConfig;
