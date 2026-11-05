import type { NextConfig } from "next";
import { runGuard } from "./scripts/guard-js-configs.mjs";

if (runGuard() !== 0) {
  process.exit(1);
}

const nextConfig: NextConfig = {
  output: 'standalone',
  // Preserve Django's trailing-slash API paths through the forwarding proxy.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const upstream = process.env.INTERNAL_API_URL?.replace(/\/$/, '');
    if (!upstream) return [];
    return ['/api', '/social', '/ws', '/media/avatars'].map(prefix => ({
      source: `${prefix}/:path*`,
      destination: `${upstream}${prefix}/:path*${prefix === '/media/avatars' ? '' : '/'}`,
    }));
  },
};

export default nextConfig;
