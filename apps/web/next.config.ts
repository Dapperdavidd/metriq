import type { NextConfig } from "next";

// The frozen core is a source-only TS package; Next transpiles it in place, so there
// is no build step for the workspace packages.
const nextConfig: NextConfig = {
  transpilePackages: ["@metriq/core"],
};

export default nextConfig;
