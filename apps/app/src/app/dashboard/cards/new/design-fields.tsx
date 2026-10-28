"use client";

import { useState } from "react";
import Image from "next/image";
import { Input } from "@stamply/ui/input";
import { Label } from "@stamply/ui/label";
import { cn } from "@stamply/ui/utils";
import { useTranslations } from "@stamply/i18n/provider";
import { LoyaltyCard } from "@/components/loyalty-card";
import { brandStyle } from "@/lib/brand";
import type { CardDesign } from "@/lib/programs/design";
import type { AssetKind } from "@/lib/assets/url";
import type { AssetLibrary } from "@/lib/assets/library";
import type { ProgramType } from "@/types/database";

// 1x1-ish placeholder QR so the preview never fetches anything.
const QR_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect width="150" height="150" fill="white"/><path d="M10 10h40v40H10zM100 10h40v40h-40zM10 100h40v40H10zM60 60h30v30H60z" fill="black"/></svg>',
  );

/** One image field: upload a new file, pick from the library, or remove. */
function ImageField({
  kind,
  label,
  hint,
  accept,
  value,
  library,
  onChange,
}: {
  kind: AssetKind;
  label: string;
  hint: string;
  accept: string;
  value: string | null;
  library: AssetLibrary[AssetKind];
  onChange: (url: string | null) => void;
}) {
  const f = useTranslations().dashboard.programs.form;
  const [open, setOpen] = useState(false);
  // A freshly chosen file is uploaded on submit (field name = kind); a library
  // pick or the current URL travels as `{kind}_pick`, validated server-side.
  const [fileChosen, setFileChosen] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`design_${kind}`}>{label}</Label>
      <Input
        id={`design_${kind}`}
        name={kind}
        type="file"
        accept={accept}
        className="file:bg-muted h-auto cursor-pointer py-1.5 file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1 file:text-sm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          setFileChosen(!!file);
          if (file) onChange(URL.createObjectURL(file));
        }}
      />
      <div className="flex gap-3 text-xs">
        <button
          type="button"
          className="text-muted-foreground underline"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {f.pickFromLibrary}
        </button>
        {value && (
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive underline"
            onClick={() => onChange(null)}
          >
            {f.removeImage}
          </button>
        )}
      </div>
      {open &&
        (library.length === 0 ? (
          <p className="text-muted-foreground text-xs">{f.libraryEmpty}</p>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {library.map((a) => (
              <button
                key={a.url}
                type="button"
                aria-label={label}
                aria-pressed={a.url === value}
                onClick={() => {
                  setFileChosen(false);
                  onChange(a.url);
                }}
                className={cn(
                  "bg-muted relative aspect-square overflow-hidden rounded-md border",
                  a.url === value && "ring-primary ring-2",
                )}
              >
                {kind === "stamp" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- SVG must not go through next/image.
                  <img src={a.url} alt="" className="size-full object-contain" />
                ) : (
                  <Image
                    src={a.url}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-contain"
                  />
                )}
              </button>
            ))}
          </div>
        ))}
      {!fileChosen && value && (
        <input type="hidden" name={`${kind}_pick`} value={value} />
      )}
      {value === null && <input type="hidden" name={`remove_${kind}`} value="1" />}
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}

export function DesignFields({
  businessName,
  initial,
  library,
  type,
  programName,
}: {
  businessName: string;
  initial: CardDesign;
  library: AssetLibrary;
  type: ProgramType;
  programName: string;
}) {
  const dict = useTranslations();
  const f = dict.dashboard.programs.form;
  const b = dict.dashboard.settings.businessForm;
  const [d, setD] = useState(initial);
  const set = (patch: Partial<CardDesign>) => setD((x) => ({ ...x, ...patch }));

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1.5 text-sm font-medium">{f.designTitle}</legend>

      <div className="grid grid-cols-2 gap-4">
        {(
          [
            ["primary_color", b.primaryColorLabel],
            ["secondary_color", b.accentColorLabel],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="flex flex-col gap-1.5">
            <Label htmlFor={key}>{label}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                id={key}
                name={key}
                value={d[key]}
                onChange={(e) => set({ [key]: e.target.value })}
                className="border-input h-10 w-12 cursor-pointer rounded-lg border"
              />
              <span className="text-muted-foreground text-sm">{d[key]}</span>
            </div>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="show_business_name"
          value="1"
          checked={d.show_business_name}
          onChange={(e) => set({ show_business_name: e.target.checked })}
          className="border-input size-4 cursor-pointer rounded border"
        />
        {b.showNameCheckbox}
      </label>

      <ImageField
        kind="logo"
        label={b.logoLabel}
        hint={b.logoHint}
        accept="image/png,image/jpeg,image/webp"
        value={d.logo_url}
        library={library.logo}
        onChange={(logo_url) => set({ logo_url })}
      />
      <ImageField
        kind="background"
        label={b.passBgLabel}
        hint={b.passBgHint}
        accept="image/png,image/jpeg,image/webp"
        value={d.background_image_url}
        library={library.background}
        onChange={(background_image_url) => set({ background_image_url })}
      />
      <ImageField
        kind="stamp"
        label={b.stampIconLabel}
        hint={b.stampIconHint}
        accept="image/svg+xml"
        value={d.stamp_icon_url}
        library={library.stamp}
        onChange={(stamp_icon_url) => set({ stamp_icon_url })}
      />

      <div>
        <p className="mb-2 text-sm font-medium">{f.previewTitle}</p>
        <div className="max-w-xs" style={brandStyle(d.primary_color)}>
          <LoyaltyCard
            businessName={businessName}
            program={{
              name: programName,
              type,
              goal: 8,
              reward_description: "",
            }}
            progress={3}
            completed={false}
            logoUrl={d.logo_url}
            backgroundImageUrl={d.background_image_url}
            stampIconUrl={d.stamp_icon_url}
            showBusinessName={d.show_business_name}
            availableRewards={0}
            qrImageUrl={QR_PLACEHOLDER}
            stampsLabel={dict.card.stamps}
            nameLabel={dict.card.name}
            rewardsLabel={dict.card.rewards}
            guestLabel={dict.card.guest}
            rewardReadyLabel={dict.card.rewardReady}
          />
        </div>
      </div>
    </fieldset>
  );
}
