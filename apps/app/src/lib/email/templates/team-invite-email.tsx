import { Button, Section, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export interface TeamInviteEmailProps {
  preview: string;
  heading: string;
  body: string;
  cta: string;
  footer: string;
  url: string;
}

/** Sent when an owner/admin invites someone to join their business's team. */
export function TeamInviteEmail({
  preview,
  heading,
  body,
  cta,
  footer,
  url,
}: TeamInviteEmailProps) {
  return (
    <EmailLayout previewText={preview}>
      <Text className="m-0 mb-3 text-xl font-bold text-[#111111]">
        {heading}
      </Text>
      <Text className="m-0 mb-6 text-sm leading-6 text-[#3f3f46]">{body}</Text>
      <Section className="mb-6">
        <Button
          href={url}
          className="rounded-lg bg-[#7c5cfc] px-6 py-3 text-sm font-semibold text-white"
        >
          {cta}
        </Button>
      </Section>
      <Text className="m-0 text-xs text-[#a1a1aa]">{footer}</Text>
    </EmailLayout>
  );
}
