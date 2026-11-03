import type { NextConfig } from "next";
import { runGuard } from "./scripts/guard-js-configs.mjs";

if (runGuard() !== 0) {
  process.exit(1);
}

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
