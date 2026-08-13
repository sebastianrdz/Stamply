import type { MetadataRoute } from "next";

const marketingUrl =
  process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3001";

export default function robots(): MetadataRoute.Robots {
  const base = marketingUrl.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
