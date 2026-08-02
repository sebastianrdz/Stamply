"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import {
  updateBusiness,
  type SettingsState,
} from "@/lib/businesses/settings-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Business } from "@/types/database";

const initialState: SettingsState = {};

/**
 * Logo / background image picker. Shows the current stored image (or a newly
 * chosen file preview), lets the user replace it, and — for an existing image —
 * remove it via a hidden `remove_{name}` flag the server action reads.
 */
function ImageUploadField({
  name,
  removeField,
  label,
  hint,
  currentUrl,
  previewClassName,
}: {
  name: "logo" | "background_image";
  removeField: "remove_logo" | "remove_background";
  label: string;
  hint: string;
  currentUrl: string | null;
  previewClassName: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  const shown = preview ?? (removed ? null : currentUrl);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "bg-muted text-muted-foreground/60 relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border",
            previewClassName,
          )}
        >
          {shown ? (
            <Image
              src={shown}
              alt={`${label} preview`}
              fill
              unoptimized
              className="object-contain"
            />
          ) : (
            <span className="text-xs">None</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Input
            id={name}
            name={name}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="file:bg-muted h-auto cursor-pointer py-1.5 file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1 file:text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
              if (file) setRemoved(false);
            }}
          />
          {currentUrl && !preview && !removed && (
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive self-start text-xs underline"
              onClick={() => setRemoved(true)}
            >
              Remove current image
            </button>
          )}
          {removed && (
            <button
              type="button"
              className="text-muted-foreground self-start text-xs underline"
              onClick={() => setRemoved(false)}
            >
              Keep current image
            </button>
          )}
        </div>
      </div>
      {removed && <input type="hidden" name={removeField} value="1" />}
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}

export function SettingsForm({ business }: { business: Business }) {
  const [state, formAction, pending] = useActionState(
    updateBusiness,
    initialState,
  );

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Business name</Label>
        <Input id="name" name="name" defaultValue={business.name} required />
        <label
          htmlFor="show_business_name"
          className="mt-1 flex items-center gap-2 text-sm"
        >
          <input
            type="checkbox"
            id="show_business_name"
            name="show_business_name"
            value="1"
            defaultChecked={business.show_business_name}
            className="border-input text-primary focus-visible:ring-ring size-4 cursor-pointer rounded border focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
          />
          Show business name on wallet passes
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand_primary_color">Primary color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              name="brand_primary_color"
              id="brand_primary_color"
              defaultValue={business.brand_primary_color}
              className="border-input h-10 w-12 cursor-pointer rounded-lg border"
            />
            <span className="text-muted-foreground text-sm">
              {business.brand_primary_color}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand_secondary_color">Accent color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              name="brand_secondary_color"
              id="brand_secondary_color"
              defaultValue={business.brand_secondary_color}
              className="border-input h-10 w-12 cursor-pointer rounded-lg border"
            />
            <span className="text-muted-foreground text-sm">
              {business.brand_secondary_color}
            </span>
          </div>
        </div>
      </div>

      <ImageUploadField
        name="logo"
        removeField="remove_logo"
        label="Logo"
        currentUrl={business.logo_url}
        previewClassName="size-16"
        hint="Shown in the top-left corner of the wallet pass. Use a square PNG for best results."
      />

      <ImageUploadField
        name="background_image"
        removeField="remove_background"
        label="Pass background"
        currentUrl={business.background_image_url}
        previewClassName="h-16 w-28"
        hint="Sits behind the stamps on the wallet pass. Use a wide image (about 3:1); it will be scaled to fit."
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="timezone">Timezone</Label>
        <Input
          id="timezone"
          name="timezone"
          defaultValue={business.timezone}
          placeholder="America/New_York"
        />
      </div>

      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="text-success text-sm" role="status">
          Saved.
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
