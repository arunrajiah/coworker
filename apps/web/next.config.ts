import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@coworker/core'],
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
}

export default nextConfig
