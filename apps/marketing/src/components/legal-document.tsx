import type { Dictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";

type LegalDocKey = "privacy" | "terms";

type TextSection = { heading: string; body: string };

type ProcessorsSection = {
  heading: string;
  intro: string;
  items: Record<string, string>;
};

export function LegalDocument({
  dict,
  doc,
}: {
  dict: Dictionary;
  doc: LegalDocKey;
}) {
  const { title, intro, sections } = dict.legal[doc];
  const { placeholders } = dict.legal;

  return (
    <div>
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        {dict.legal.draftNotice}
      </div>

      <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {dict.legal.lastUpdatedLabel}: {dict.legal.lastUpdatedDate}
      </p>
      <p className="text-muted-foreground mt-6">{interpolate(intro, placeholders)}</p>

      {Object.entries(sections).map(([key, section]) => {
        // `thirdPartyProcessors` only exists under `legal.privacy.sections`
        // and has a different shape ({heading, intro, items}) than every
        // other section ({heading, body}). `Object.entries` can't preserve
        // that per-key distinction, so it's narrowed with a targeted cast
        // here — the dictionary shape is fixed, known JSON, not user input.
        if (key === "thirdPartyProcessors") {
          const processors = section as ProcessorsSection;
          return (
            <section key={key}>
              <h2 className="mt-10 mb-3 text-2xl font-bold tracking-tight">
                {processors.heading}
              </h2>
              <p className="text-muted-foreground mb-4">
                {interpolate(processors.intro, placeholders)}
              </p>
              <ul className="text-muted-foreground mb-4 list-disc space-y-2 pl-6">
                {Object.values(processors.items).map((item, i) => (
                  <li key={i}>{interpolate(item, placeholders)}</li>
                ))}
              </ul>
            </section>
          );
        }

        const { heading, body } = section as TextSection;
        return (
          <section key={key}>
            <h2 className="mt-10 mb-3 text-2xl font-bold tracking-tight">{heading}</h2>
            {interpolate(body, placeholders)
              .split("\n\n")
              .map((paragraph, i) => (
                <p key={i} className="text-muted-foreground mb-4">
                  {paragraph}
                </p>
              ))}
          </section>
        );
      })}
    </div>
  );
}
