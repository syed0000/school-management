import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', '']
    }
  },
  images: {
    remotePatterns: [
      new URL('https://sin1.contabostorage.com/57ac8fdeef3d4c50953d636ac0452829:tenants-app/**')
    ],
  },

  async redirects() {
    return [
      {
        source: '/:path*',
        destination: 'https://mns.feeease.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
