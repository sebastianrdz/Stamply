import { Button, Section, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export interface MonthlySummaryEmailProps {
  preview: string;
  heading: string;
  lines: string[];
  cta: string;
  footer: string;
  url: string;
}

/** Monthly "how many customers came back" summary sent to a business owner. */
export function MonthlySummaryEmail({
  preview,
  heading,
  lines,
  cta,
  footer,
  url,
}: MonthlySummaryEmailProps) {
  return (
    <EmailLayout previewText={preview}>
      <Text className="m-0 mb-3 text-xl font-bold text-[#111111]">
        {heading}
      </Text>
      {lines.map((line) => (
        <Text key={line} className="m-0 mb-3 text-sm leading-6 text-[#3f3f46]">
          {line}
        </Text>
      ))}
      <Section className="mb-6 mt-3">
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
