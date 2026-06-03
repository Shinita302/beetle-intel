import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Monorepo: app in project/ when repo root is one level up (local + Vercel).
  outputFileTracingRoot: path.join(__dirname, '..'),
};

export default nextConfig;
