"use client";

import { useActionState, useRef, useEffect } from "react";
import {
  createLocation,
  type LocationFormState,
} from "@/lib/locations/actions";
import { useTranslations } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LocationFormState = {};

export function LocationForm() {
  const dict = useTranslations();
  const [state, formAction, pending] = useActionState(
    createLocation,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state.error]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4 sm:flex-row sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="name">{dict.dashboard.locations.form.nameLabel}</Label>
        <Input
          id="name"
          name="name"
          placeholder={dict.dashboard.locations.form.namePlaceholder}
          required
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="address">
          {dict.dashboard.locations.form.addressLabel}
        </Label>
        <Input
          id="address"
          name="address"
          placeholder={dict.dashboard.locations.form.addressPlaceholder}
        />
      </div>
      <div className="flex gap-2">
        <div className="flex w-24 flex-col gap-1.5">
          <Label htmlFor="lat">{dict.dashboard.locations.form.latLabel}</Label>
          <Input
            id="lat"
            name="lat"
            type="number"
            step="any"
            placeholder="40.71"
          />
        </div>
        <div className="flex w-24 flex-col gap-1.5">
          <Label htmlFor="lng">{dict.dashboard.locations.form.lngLabel}</Label>
          <Input
            id="lng"
            name="lng"
            type="number"
            step="any"
            placeholder="-74.0"
          />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending
          ? dict.dashboard.locations.form.adding
          : dict.dashboard.locations.form.add}
      </Button>
      {state.error && (
        <p className="text-destructive w-full text-sm" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
