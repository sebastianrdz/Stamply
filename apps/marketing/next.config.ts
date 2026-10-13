import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: { root: path.resolve(import.meta.dirname, "../..") },
  images: { formats: ["image/avif", "image/webp"] },
};

export default nextConfig;
