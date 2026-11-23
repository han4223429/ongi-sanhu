import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Explicit local hosts only; do not trust entire private/public address ranges.
  allowedDevOrigins: ["127.0.0.1", ...(process.env.DEV_ALLOWED_ORIGINS?.split(",").map((host) => host.trim()).filter(Boolean) ?? [])],
  headers() {
    const development = process.env.NODE_ENV === "development";
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Content-Security-Policy", value: [
          "default-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'",
          // Next's static/PPR bootstrap uses inline scripts; nonce CSP requires dynamic rendering.
          `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
          "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'",
          `connect-src 'self'${development ? " ws: wss:" : ""}`,
        ].join("; ") },
      ],
    }];
  },
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
