import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', '']
    }
  },
  images: {
    remotePatterns: [new URL('https://sin1.contabostorage.com/57ac8fdeef3d4c50953d636ac0452829:tenants-app/**')],
  },
};

export default nextConfig;
