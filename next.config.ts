
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // Explicitly set output mode
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverRuntimeConfig: {
    // This will be available only on the server side
    geminiApiKey: process.env.GEMINI_API_KEY,
    googleApiKey: process.env.GOOGLE_API_KEY,
  },
  publicRuntimeConfig: {
    // This will be available on both server and client side
    // Be careful not to expose sensitive information here
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
  transpilePackages: ['tailwind-merge'], // Explicitly transpile tailwind-merge
  // This webpack configuration is for when Turbopack is NOT used.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude 'async_hooks' from client-side bundles for Webpack
      // by aliasing it to false, which Webpack interprets as an empty module.
      config.resolve.alias = {
        ...config.resolve.alias,
        'async_hooks': false,
      };
    }
    return config;
  },
  experimental: {
    // Allow requests from your specific cloud workstation domain during development
    allowedDevOrigins: [
        //'https://6000-firebase-studio-1747674027809.cluster-ubrd2huk7jh6otbgyei4h62ope.cloudworkstations.dev',
        'https://9003-firebase-studio-1747674027809.cluster-ubrd2huk7jh6otbgyei4h62ope.cloudworkstations.dev'
    ],
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
