import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const projectDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin workspace root so Tailwind/CSS resolve from this app (not ~/package-lock.json).
  outputFileTracingRoot: projectDir,
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? 'development',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
