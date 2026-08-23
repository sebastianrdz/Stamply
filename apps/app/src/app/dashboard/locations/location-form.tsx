"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { LocateFixed } from "lucide-react";
import {
  createLocation,
  type LocationFormState,
} from "@/lib/locations/actions";
import { useTranslations } from "@stamply/i18n/provider";
import { Button } from "@stamply/ui/button";
import { Input } from "@stamply/ui/input";
import { Label } from "@stamply/ui/label";

const initialState: LocationFormState = {};

export function LocationForm() {
  const dict = useTranslations();
  const [state, formAction, pending] = useActionState(
    createLocation,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state.error]);

  function handleUseLocation() {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError(dict.dashboard.locations.form.geoError);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // ~6 decimals ≈ 0.1 m — plenty for a store's geofence, and matches the
        // manual-entry precision the lat/lng number fields accept.
        if (latRef.current)
          latRef.current.value = pos.coords.latitude.toFixed(6);
        if (lngRef.current)
          lngRef.current.value = pos.coords.longitude.toFixed(6);
        setLocating(false);
      },
      () => {
        setGeoError(dict.dashboard.locations.form.geoError);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="flex flex-col gap-4 lg:flex-row lg:items-end"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="name">
            {dict.dashboard.locations.form.nameLabel}
          </Label>
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
        <div className="flex items-end gap-2">
          <div className="flex w-24 flex-col gap-1.5">
            <Label htmlFor="lat">
              {dict.dashboard.locations.form.latLabel}
            </Label>
            <Input
              ref={latRef}
              id="lat"
              name="lat"
              type="number"
              step="any"
              placeholder="40.71"
            />
          </div>
          <div className="flex w-24 flex-col gap-1.5">
            <Label htmlFor="lng">
              {dict.dashboard.locations.form.lngLabel}
            </Label>
            <Input
              ref={lngRef}
              id="lng"
              name="lng"
              type="number"
              step="any"
              placeholder="-74.0"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleUseLocation}
            disabled={locating}
          >
            <LocateFixed className="size-4" />
            {locating
              ? dict.dashboard.locations.form.locating
              : dict.dashboard.locations.form.useCurrentLocation}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending
              ? dict.dashboard.locations.form.adding
              : dict.dashboard.locations.form.add}
          </Button>
        </div>
      </form>
      {(state.error || geoError) && (
        <p className="text-destructive w-full text-sm" role="alert">
          {state.error ?? geoError}
        </p>
      )}
    </>
  );
}
