import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // Skip static generation for pages that require env vars at build time
  // All auth and dashboard pages are dynamic (use cookies/session)
  experimental: {
    // Disable static optimization for pages using Supabase client
  },
}

export default nextConfig
