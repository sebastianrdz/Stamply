import path from "node:path";
import type { NextConfig } from "next";

// Business logos/background images are user-uploaded to Supabase Storage and
// served via getPublicUrl() — allow next/image to optimize that domain only,
// derived from NEXT_PUBLIC_SUPABASE_URL (zod-validated in src/lib/env.ts)
// rather than hardcoding a hostname literal.
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Pin to the monorepo root (where pnpm-lock.yaml lives). The React Compiler's
  // babel loader gets paths relative to it; a mismatched root panics HMR.
  turbopack: { root: path.resolve(import.meta.dirname, "../..") },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseUrl.hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // @resvg/resvg-js ships a native N-API binding (js-binding.js) that
  // Turbopack can't place in an ESM chunk graph — opt it out of bundling so
  // it's loaded via plain Node `require` at runtime instead. Confirmed the
  // key name against node_modules/next/dist/docs/.../serverExternalPackages.md
  // (stable, top-level as of Next 15+, not under `experimental`).
  serverExternalPackages: ["@resvg/resvg-js"],
  experimental: {
    // Settings uploads a logo + background image (up to 4 MB each) via a
    // Server Action; the default 1 MB body limit rejects them. Leave headroom
    // for both files plus multipart boundary/field overhead.
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Dashboard pages are dynamic (they read cookies() via requireBusiness()),
    // so Next's client Router Cache treats them as stale after 0s by default,
    // replaying loading.tsx and refetching on every revisit. Every mutating
    // Server Action calls revalidatePath() for the paths it touches, which
    // invalidates this cache entry immediately — so this window only lets
    // *unchanged* pages reuse their cached segment; real changes still show
    // up on the next navigation.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  // Proxy posthog-js's browser traffic through this app's own domain so ad
  // blockers are less likely to strip it. posthog-node talks directly to
  // POSTHOG_HOST server-to-server and never goes through this rewrite.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
