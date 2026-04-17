import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@coworker/core'],
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
  webpack: (config) => {
    // Resolve .js imports to .ts files for workspace packages (ESM TypeScript convention)
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    }
    return config
  },
}

export default nextConfig
