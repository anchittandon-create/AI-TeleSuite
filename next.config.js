
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
    serverActions: {
      bodySizeLimit: '150mb', // Increase body size limit to safely handle 100MB files after Base64 encoding
    },
  },
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.md$/,
      use: 'raw-loader',
    });

    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['@opentelemetry/exporter-jaeger'] = false;
    config.resolve.alias['@opentelemetry/exporter-zipkin'] = false;
    if (!isServer) {
      config.resolve.alias['handlebars'] = false;
    } else {
      config.externals = config.externals || [];
      config.externals.push({ handlebars: 'commonjs handlebars' });
    }

    if (!isServer) {
        config.resolve.alias['async_hooks'] = require.resolve('./src/lib/empty-module.ts');
    }

    return config;
  },
};

module.exports = nextConfig;
