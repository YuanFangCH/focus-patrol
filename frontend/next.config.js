/** @type {import('next').NextConfig} */
const API_UPSTREAM =
  process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE !== '/'
    ? process.env.NEXT_PUBLIC_API_BASE
    : 'http://127.0.0.1:3001';

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001',
  },
  async rewrites() {
    // 前端进程自身代理 /api/* → 后端,保证直连主站(3000)或经反代(8888)都能访问 API
    return [
      {
        source: '/api/:path*',
        destination: `${API_UPSTREAM}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
