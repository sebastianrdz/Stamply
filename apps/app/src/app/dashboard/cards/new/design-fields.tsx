"use client";

import { useRef, useState, type ReactNode } from "react";
import { ImagePlus, Images, Pencil, Upload } from "lucide-react";
import Image from "next/image";
import { Button } from "@stamply/ui/button";
import { Label } from "@stamply/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@stamply/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@stamply/ui/tabs";
import { STAMP_ICONS, svgFileFrom } from "@/lib/stamp-icons";
import { cn } from "@stamply/ui/utils";
import { useTranslations } from "@stamply/i18n/provider";
import type { CardDesign } from "@/lib/programs/design";
import type { AssetKind } from "@/lib/assets/url";
import type { AssetLibrary } from "@/lib/assets/library";
import type { ProgramType } from "@/types/database";

/** One image field: upload a new file, pick from the library, or remove. */
export function ImageField({
  kind,
  name = kind,
  label,
  hint,
  accept,
  value,
  library,
  onChange,
  compact = false,
  color,
  onColorChange,
}: {
  kind: AssetKind;
  /** Form field name; defaults to `kind` (stamp-icon rows need distinct names). */
  name?: string;
  label: string;
  hint?: string;
  accept: string;
  value: string | null;
  library: AssetLibrary[AssetKind];
  onChange: (url: string | null) => void;
  /** Just the round thumbnail, for inline use in rows. Stamp icons only. */
  compact?: boolean;
  /** Stamp icons only: tint color (null = the icon's own colors) and its setter. */
  color?: string | null;
  onColorChange?: (color: string | null) => void;
}) {
  const f = useTranslations().dashboard.programs.form;
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // A freshly chosen file is uploaded on submit (field name = kind); a library
  // pick or the current URL travels as `{kind}_pick`, validated server-side.
  const [fileChosen, setFileChosen] = useState(false);
  const isStamp = kind === "stamp";

  /** Hand a file to the real input so it submits with the form. */
  const chooseFile = (file: File | undefined) => {
    if (!file || !inputRef.current) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    inputRef.current.files = dt.files;
    setFileChosen(true);
    onChange(URL.createObjectURL(file));
    setOpen(false);
  };
  // A pending file would win over a pick/remove on the server, so drop it first.
  const clearFile = () => {
    if (inputRef.current) inputRef.current.value = "";
    setFileChosen(false);
  };
  const choosePick = (url: string) => {
    clearFile();
    onChange(url);
    setOpen(false);
  };
  const remove = () => {
    clearFile();
    onChange(null);
    setOpen(false);
  };

  const thumb =
    value && color ? (
      // Mask, not <img>: recolors any SVG and never executes it.
      <span
        className="size-full"
        style={{
          backgroundColor: color,
          maskImage: `url("${value}")`,
          WebkitMaskImage: `url("${value}")`,
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
        }}
      />
    ) : value ? (
      // eslint-disable-next-line @next/next/no-img-element -- also shows blob: previews and raw SVGs, which next/image can't.
      <img src={value} alt="" className="size-full object-contain" />
    ) : (
      <ImagePlus className="size-4" />
    );

  const picker = (trigger: ReactNode) => (
    <ImagePopover
      kind={kind}
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      value={value}
      library={library}
      onUpload={() => inputRef.current?.click()}
      onPickUrl={choosePick}
      onPickFile={chooseFile}
      onRemove={remove}
      color={color}
      onColorChange={onColorChange}
    />
  );

  return (
    <div className={compact ? "flex items-center" : "flex flex-col gap-1.5"}>
      {!compact && <Label htmlFor={`design_${name}`}>{label}</Label>}
      <input
        ref={inputRef}
        id={`design_${name}`}
        name={name}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          setFileChosen(!!file);
          if (file) {
            onChange(URL.createObjectURL(file));
            setOpen(false);
          }
        }}
      />
      {compact ? (
        picker(
          <button
            type="button"
            aria-label={label}
            title={label}
            className="bg-muted text-muted-foreground hover:bg-muted/70 relative grid size-10 shrink-0 place-items-center rounded-full border"
          >
            <span className="grid size-7 place-items-center overflow-hidden">
              {thumb}
            </span>
            <Pencil className="bg-background absolute -right-0.5 -bottom-0.5 size-4 rounded-full border p-0.5" />
          </button>,
        )
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            chooseFile(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex items-center gap-3 rounded-lg border border-dashed p-2 transition-colors",
            dragging && "border-primary bg-primary/5",
          )}
        >
          <div className="bg-muted text-muted-foreground grid size-10 shrink-0 place-items-center overflow-hidden rounded-md">
            {thumb}
          </div>
          <p className="text-muted-foreground min-w-0 flex-1 text-xs">{hint}</p>
          {picker(
            <Button type="button" variant="outline" size="sm">
              <Images className="size-3.5" />
              {isStamp ? f.chooseIcon : f.chooseImage}
            </Button>,
          )}
        </div>
      )}
      {!fileChosen && value && (
        <input type="hidden" name={`${name}_pick`} value={value} />
      )}
      {value === null && (
        <input type="hidden" name={`remove_${name}`} value="1" />
      )}
    </div>
  );
}

/** Previously uploaded images of one kind, as a grid of pick buttons. */
function LibraryGrid({
  library,
  value,
  label,
  kind,
  onPick,
}: {
  library: AssetLibrary[AssetKind];
  value: string | null;
  label: string;
  kind: AssetKind;
  onPick: (url: string) => void;
}) {
  const f = useTranslations().dashboard.programs.form;
  if (library.length === 0)
    return <p className="text-muted-foreground text-xs">{f.libraryEmpty}</p>;
  return (
    <div className="grid grid-cols-5 gap-2">
      {library.map((a) => (
        <button
          key={a.url}
          type="button"
          aria-label={label}
          aria-pressed={a.url === value}
          onClick={() => onPick(a.url)}
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
  );
}

/** The one image selector: uploads and uploaded images (plus ready-made icons for stamps). */
function ImagePopover({
  kind,
  open,
  onOpenChange,
  trigger,
  value,
  library,
  onUpload,
  onPickUrl,
  onPickFile,
  onRemove,
  color,
  onColorChange,
}: {
  kind: AssetKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  value: string | null;
  library: AssetLibrary[AssetKind];
  onUpload: () => void;
  onPickUrl: (url: string) => void;
  onPickFile: (file: File) => void;
  onRemove: () => void;
  color?: string | null;
  onColorChange?: (color: string | null) => void;
}) {
  const f = useTranslations().dashboard.programs.form;
  const uploaded = (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" size="sm" onClick={onUpload}>
        <Upload className="size-3.5" />
        {f.uploadNew}
      </Button>
      <LibraryGrid
        library={library}
        value={value}
        label={f.pickFromLibrary}
        kind={kind}
        onPick={onPickUrl}
      />
    </div>
  );
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72">
        {kind === "stamp" ? (
          <Tabs
            defaultValue={library.length > 0 ? "uploaded" : "icons"}
            className="flex flex-col gap-3"
          >
            <TabsList>
              <TabsTrigger value="uploaded">{f.tabUploaded}</TabsTrigger>
              <TabsTrigger value="icons">{f.tabIcons}</TabsTrigger>
            </TabsList>
            <TabsContent value="uploaded">{uploaded}</TabsContent>
            <TabsContent value="icons">
              <div className="grid max-h-56 grid-cols-6 gap-1.5 overflow-y-auto">
                {STAMP_ICONS.map(({ name, Icon }) => (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    aria-label={name}
                    onClick={(e) => {
                      const svg = e.currentTarget.querySelector("svg");
                      if (svg) onPickFile(svgFileFrom(svg, name.toLowerCase()));
                    }}
                    className="grid aspect-square place-items-center rounded-md bg-neutral-800 hover:bg-neutral-700"
                  >
                    <Icon weight="fill" color="#ffffff" size={22} />
                  </button>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          uploaded
        )}
        {kind === "stamp" && onColorChange && (
          <div className="mt-3 flex items-center gap-2 border-t pt-3">
            <label htmlFor="icon_color_picker" className="text-xs font-medium">
              {f.iconColorLabel}
            </label>
            <input
              type="color"
              id="icon_color_picker"
              value={color ?? "#ffffff"}
              onChange={(e) => onColorChange(e.target.value)}
              className="border-input h-7 w-9 cursor-pointer rounded-md border"
            />
            <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
              {color ?? f.iconColorOriginal}
            </span>
            {color && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground text-xs underline"
                onClick={() => onColorChange(null)}
              >
                {f.iconColorReset}
              </button>
            )}
          </div>
        )}
        {value && (
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive mt-3 text-xs underline"
          >
            {kind === "stamp" ? f.removeIcon : f.removeImage}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function DesignFields({
  d,
  set,
  library,
  type,
}: {
  d: CardDesign;
  set: (patch: Partial<CardDesign>) => void;
  library: AssetLibrary;
  type: ProgramType;
}) {
  const dict = useTranslations();
  const f = dict.dashboard.programs.form;
  const b = dict.dashboard.settings.businessForm;

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
      {/* Every card type: the overlay sits on whatever background image the card has. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="overlay_opacity">{f.overlayLabel}</Label>
          <span className="text-muted-foreground text-sm tabular-nums">
            {Math.round(d.overlay_opacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          id="overlay_opacity"
          name="overlay_opacity"
          min={0}
          max={100}
          step={5}
          value={Math.round(d.overlay_opacity * 100)}
          onChange={(e) =>
            set({ overlay_opacity: Number(e.target.value) / 100 })
          }
          className="accent-primary w-full cursor-pointer"
        />
        <p className="text-muted-foreground text-xs">{f.overlayHint}</p>
      </div>
      {type === "stamp" && (
        <ImageField
          kind="stamp"
          label={b.stampIconLabel}
          hint={b.stampIconHint}
          accept="image/svg+xml"
          value={d.stamp_icon_url}
          library={library.stamp}
          onChange={(stamp_icon_url) => set({ stamp_icon_url })}
          color={d.stamp_color}
          onColorChange={(stamp_color) => set({ stamp_color })}
        />
      )}
      {/* Empty = icons keep their own colors; chosen in the stamp icon popover. */}
      <input type="hidden" name="stamp_color" value={d.stamp_color ?? ""} />
    </fieldset>
  );
}
