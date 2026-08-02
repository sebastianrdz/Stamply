import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    // Settings uploads a logo + background image (up to 4 MB each) via a
    // Server Action; the default 1 MB body limit rejects them. Leave headroom
    // for both files plus multipart boundary/field overhead.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
