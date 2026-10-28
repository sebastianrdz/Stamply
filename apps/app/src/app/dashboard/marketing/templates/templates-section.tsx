"use client";

import * as React from "react";
import { useTranslations } from "@stamply/i18n/provider";
import { interpolate } from "@stamply/i18n/format";
import { Card, CardHeader, CardTitle, CardContent } from "@stamply/ui/card";
import { Button } from "@stamply/ui/button";
import type { ProgramType } from "@/types/database";
import { downloadSvgAsPng } from "./download-svg";
import {
  FORMAT_SIZES,
  templateFilename,
  type TemplateKey,
} from "./svg-helpers";
import { TemplateStory, TemplateSquare, TemplateA5 } from "./template-formats";
import { TemplatePlayful } from "./template-playful";
import { TemplateElegant } from "./template-elegant";
import { TemplateRetro } from "./template-retro";

interface TemplatesSectionProps {
  program: { name: string; type: ProgramType; reward_description: string };
  business: {
    name: string;
    brand_primary_color: string;
    brand_secondary_color: string;
    logo_url: string | null;
    background_image_url: string | null;
    show_business_name: boolean;
  };
  qrDataUrl: string;
}

// All three template components share an identical prop signature, so any
// one of them can stand in for the group's type here.
type TemplateComponent = typeof TemplatePlayful;

const PRINT_TEMPLATES: { key: TemplateKey; Component: TemplateComponent }[] = [
  { key: "playful", Component: TemplatePlayful },
  { key: "elegant", Component: TemplateElegant },
  { key: "retro", Component: TemplateRetro },
  { key: "a5", Component: TemplateA5 },
];

const SOCIAL_TEMPLATES: { key: TemplateKey; Component: TemplateComponent }[] = [
  { key: "story", Component: TemplateStory },
  { key: "square", Component: TemplateSquare },
];

export function TemplatesSection({
  program,
  business,
  qrDataUrl,
}: TemplatesSectionProps) {
  const dict = useTranslations();
  const t = dict.dashboard.programs.templates;

  const names: Record<TemplateKey, string> = {
    playful: t.playfulName,
    elegant: t.elegantName,
    retro: t.retroName,
    story: t.storyName,
    square: t.squareName,
    a5: t.a5Name,
  };

  const headline =
    program.type === "coupon"
      ? t.couponHeadline
      : program.type === "membership"
        ? t.membershipHeadline
        : t.rewardLabel;
  const rewardText = interpolate(headline, {
    reward: program.reward_description,
  });
  const logoAlt = interpolate(t.logoAlt, { business: business.name });

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{t.sectionTitle}</h2>
        <p className="text-muted-foreground text-sm">{t.sectionDescription}</p>
      </div>

      {[
        { heading: t.printHeading, items: PRINT_TEMPLATES },
        { heading: t.socialHeading, items: SOCIAL_TEMPLATES },
      ].map(({ heading, items }) => (
        <div key={heading} className="flex flex-col gap-3">
          <h3 className="text-muted-foreground text-sm font-medium">
            {heading}
          </h3>
          <div className="grid gap-6 md:grid-cols-3">
            {items.map(({ key, Component }) => (
              <TemplateCard
                key={key}
                templateKey={key}
                name={names[key]}
                Component={Component}
                program={program}
                business={business}
                qrDataUrl={qrDataUrl}
                rewardText={rewardText}
                scanToJoinText={t.scanToJoin}
                previewAltTemplate={t.previewAlt}
                logoAlt={logoAlt}
                downloadLabel={t.download}
                downloadingLabel={t.downloading}
                errorLabel={t.downloadError}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function TemplateCard({
  templateKey,
  name,
  Component,
  program,
  business,
  qrDataUrl,
  rewardText,
  scanToJoinText,
  previewAltTemplate,
  logoAlt,
  downloadLabel,
  downloadingLabel,
  errorLabel,
}: {
  templateKey: TemplateKey;
  name: string;
  Component: TemplateComponent;
  program: TemplatesSectionProps["program"];
  business: TemplatesSectionProps["business"];
  qrDataUrl: string;
  rewardText: string;
  scanToJoinText: string;
  previewAltTemplate: string;
  logoAlt: string;
  downloadLabel: string;
  downloadingLabel: string;
  errorLabel: string;
}) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [downloading, setDownloading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const previewLabel = interpolate(previewAltTemplate, {
    name,
    program: program.name,
  });

  async function handleDownload() {
    if (!svgRef.current) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadSvgAsPng(
        svgRef.current,
        templateFilename(program.name, templateKey),
        FORMAT_SIZES[templateKey].width,
        FORMAT_SIZES[templateKey].height,
      );
    } catch {
      setError(errorLabel);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="mx-auto w-full max-w-55">
          <Component
            ref={svgRef}
            businessName={business.name}
            programName={program.name}
            rewardText={rewardText}
            scanToJoinText={scanToJoinText}
            primaryColor={business.brand_primary_color}
            secondaryColor={business.brand_secondary_color}
            logoUrl={business.logo_url}
            backgroundImageUrl={business.background_image_url}
            showBusinessName={business.show_business_name}
            qrDataUrl={qrDataUrl}
            previewLabel={previewLabel}
            logoAlt={logoAlt}
          />
        </div>

        <Button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full"
        >
          {downloading ? downloadingLabel : downloadLabel}
        </Button>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
