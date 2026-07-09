import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@metriq/core", "@metriq/chain"],
};

export default nextConfig;
