"use client";

import { useActionState } from "react";
import {
  updateBusiness,
  type SettingsState,
} from "@/lib/businesses/settings-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Business } from "@/types/database";

const initialState: SettingsState = {};

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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="logo_url">Logo URL</Label>
        <Input
          id="logo_url"
          name="logo_url"
          type="url"
          placeholder="https://…/logo.png"
          defaultValue={business.logo_url ?? ""}
        />
        <p className="text-muted-foreground text-xs">
          Shown on wallet passes. Use a square PNG for best results.
        </p>
      </div>

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
