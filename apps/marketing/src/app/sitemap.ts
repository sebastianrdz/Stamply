import type { MetadataRoute } from "next";

const marketingUrl =
  process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3001";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = marketingUrl.replace(/\/$/, "");

  return [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      alternates: {
        languages: {
          es: `${base}/`,
          en: `${base}/`,
        },
      },
    },
  ];
}
