import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let testers open the dev server through ngrok / LAN IP.
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.app", "192.168.*.*"],
  // Browser talks to Supabase via the same origin (/sb/...), so ONE public URL (ngrok, Vercel) is enough
  // and phones never need to reach 127.0.0.1 directly.
  async rewrites() {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Keep only the origin, so a pasted ".../rest/v1/" or trailing slash can't break auth.
    const target = raw ? new URL(raw).origin : undefined;
    return target ? [{ source: "/sb/:path*", destination: `${target}/:path*` }] : [];
  },
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
