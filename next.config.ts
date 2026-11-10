import type { NextConfig } from "next";
import { isMock, resolveCommerceHubApiOrigin } from "./src/lib/config";

const nextConfig: NextConfig = {
  distDir: process.env.COMMERCEHUB_NEXT_DIST_DIR ?? ".next",
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    const apiOrigin = resolveCommerceHubApiOrigin({
      isMock,
      mockApiOrigin: process.env.COMMERCEHUB_MOCK_API_URL,
      realApiOrigin: process.env.COMMERCEHUB_REAL_API_URL,
      legacyApiOrigin: process.env.COMMERCEHUB_API_URL,
      isDevelopment: process.env.NODE_ENV === "development",
    });
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
