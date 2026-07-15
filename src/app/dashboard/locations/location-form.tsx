"use client";

import { useActionState, useRef, useEffect } from "react";
import {
  createLocation,
  type LocationFormState,
} from "@/lib/locations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LocationFormState = {};

export function LocationForm() {
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
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="Downtown" required />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" placeholder="123 Main St" />
      </div>
      <div className="flex gap-2">
        <div className="flex w-24 flex-col gap-1.5">
          <Label htmlFor="lat">Lat</Label>
          <Input
            id="lat"
            name="lat"
            type="number"
            step="any"
            placeholder="40.71"
          />
        </div>
        <div className="flex w-24 flex-col gap-1.5">
          <Label htmlFor="lng">Lng</Label>
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
        {pending ? "Adding…" : "Add"}
      </Button>
      {state.error && (
        <p className="text-destructive w-full text-sm" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
