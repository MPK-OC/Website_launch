import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let testers open the dev server through ngrok / LAN IP.
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.app", "192.168.*.*"],
  // Browser talks to Supabase via the same origin (/sb/...), so ONE public URL (ngrok, Vercel) is enough
  // and phones never need to reach 127.0.0.1 directly.
  async rewrites() {
    const target = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
