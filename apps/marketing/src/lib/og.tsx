import { ImageResponse } from "next/og";

/**
 * Shared social-card image, used by both the Open Graph and Twitter route
 * conventions (`opengraph-image.tsx` / `twitter-image.tsx`) so the two never
 * drift apart. Static English by design — the file-convention exports can't
 * read the request-scoped locale cookie.
 */
export const alt = "Stamply — digital loyalty cards";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #7C5CFC 0%, #5B3FE0 100%)",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 120,
            fontWeight: 700,
            letterSpacing: -2,
          }}
        >
          Stamply
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 36,
            fontWeight: 400,
            color: "rgba(255, 255, 255, 0.9)",
          }}
        >
          Digital loyalty cards, done right
        </div>
      </div>
    ),
    { ...size },
  );
}
