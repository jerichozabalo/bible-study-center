import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The photos card sends one already-downscaled photo per request (bst-v1.1
   * issue 4). A ≤2048px q0.88 JPEG is well under 1MB; the 4mb ceiling is
   * headroom for a slow phone camera, not a target.
   */
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },

  /**
   * The service worker must never be cached. Every other asset is invalidated
   * by the build hash in its own URL; `sw.js` keeps one address forever, so a
   * CDN holding it means a fix to the caching policy reaches installed phones
   * whenever the edge feels like it — which is the one failure a service worker
   * can make permanent.
   */
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
