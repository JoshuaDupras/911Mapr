/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/incidents/:path*',
        destination: 'http://localhost:5000/incidents/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
