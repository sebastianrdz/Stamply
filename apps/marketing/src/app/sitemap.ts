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
    {
      url: `${base}/guide`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: {
        languages: {
          es: `${base}/guide`,
          en: `${base}/guide`,
        },
      },
    },
    {
      url: `${base}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
      alternates: {
        languages: {
          es: `${base}/privacy`,
          en: `${base}/privacy`,
        },
      },
    },
    {
      url: `${base}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
      alternates: {
        languages: {
          es: `${base}/terms`,
          en: `${base}/terms`,
        },
      },
    },
  ];
}
