/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static export capability for CDN caching
  compress: true,
  
  // Image optimization
 images: {
  formats: ['image/avif', 'image/webp'],
  minimumCacheTTL: 86400,
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '**.supabase.co',
      pathname: '/storage/v1/object/public/**',
    },
  ],
},

  // HTTP headers for caching & security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
      {
        // Aggressive caching for static assets
        source: '/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },

  // Reduce bundle size
  experimental: {
    optimizeCss: true,
  },
}

module.exports = nextConfig
