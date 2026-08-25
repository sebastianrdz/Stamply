import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
} from "@react-email/components";

/**
 * Inline-SVG Stamply mark for email clients. Ported from
 * `packages/ui/src/brand/logo.tsx`'s raw `<svg>` paths — that component's
 * Tailwind-class/CSS-var version (`bg-primary`, `text-primary-foreground`,
 * `currentColor`) doesn't render in most email clients, so this copy uses
 * fixed hex colors and inline styles instead.
 */
function EmailLogoMark() {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
      <tbody>
        <tr>
          <td
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: "#7c5cfc",
              textAlign: "center",
              verticalAlign: "middle",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="#ffffff"
              width="20"
              height="20"
              style={{ display: "inline-block", verticalAlign: "middle" }}
            >
              <circle cx="12" cy="6.8" r="3.1" />
              <path d="M9.3 10.2h5.4l2.7 6.3h-10.8z" />
              <rect x="5.3" y="15.8" width="13.4" height="3.1" rx="1.55" />
              <rect x="7.5" y="20.8" width="9" height="1.5" rx="0.75" />
            </svg>
          </td>
          <td style={{ paddingLeft: 8 }}>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "#111111",
              }}
            >
              Stamply
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Shared wrapper for every transactional email template. */
export function EmailLayout({
  previewText,
  children,
}: {
  previewText: string;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="m-0 bg-[#f4f4f5] p-0 font-sans">
          <Container className="mx-auto my-10 max-w-[480px] rounded-2xl bg-white p-8 shadow-sm">
            <Section className="mb-6">
              <EmailLogoMark />
            </Section>
            {children}
            <Section className="mt-8 border-t border-[#e4e4e7] pt-4">
              <p className="m-0 text-xs text-[#71717a]">
                Stamply · stamplycards.com
              </p>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
