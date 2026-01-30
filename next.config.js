/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  assetPrefix: process.env.BASE_PATH || '',
  basePath: process.env.BASE_PATH || '',
  trailingSlash: true,
  publicRuntimeConfig: {
    root: process.env.BASE_PATH || '',
  },
  optimizeFonts: false,
  // APIルートのトレーリングスラッシュを処理
  async rewrites() {
    return [
      {
        source: '/api/:path*/',
        destination: '/api/:path*',
      },
    ]
  },
}

module.exports = nextConfig
