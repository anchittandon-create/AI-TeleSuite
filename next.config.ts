
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
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
  // This webpack configuration is for when Turbopack is NOT used.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude 'async_hooks' from client-side bundles for Webpack
      config.resolve.alias = {
        ...config.resolve.alias,
        'async_hooks': require.resolve('./src/lib/empty-module.ts'),
      };
    }
    return config;
  },
  experimental: {
    // Allow requests from your specific cloud workstation domain during development
    allowedDevOrigins: ['https://6000-firebase-studio-1747674027809.cluster-ubrd2huk7jh6otbgyei4h62ope.cloudworkstations.dev'],
    // Configure Turbopack specifically
    turbo: {
      resolveAlias: {
        // This tells Turbopack to resolve 'async_hooks' to an empty module on the client-side.
        // Using a string path relative to the project root for Turbopack.
        'async_hooks': 'src/lib/empty-module.ts', // Changed from './src/lib/empty-module.ts'
      },
    },
  },
};

export default nextConfig;
