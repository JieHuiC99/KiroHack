import { securityHeaders } from "./src/lib/security-headers";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // self-contained server for the Docker image (Vercel ignores it)
  poweredByHeader: false,
  // TypeORM: keep it (and the pg driver) out of the bundle, and keep class names intact —
  // minified entity names break relation metadata in production builds.
  serverExternalPackages: ["typeorm", "pg"],
  experimental: { serverMinification: false },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
