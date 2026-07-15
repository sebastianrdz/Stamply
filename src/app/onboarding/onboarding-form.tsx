"use client";

import { useActionState } from "react";
import {
  createBusiness,
  type CreateBusinessState,
} from "@/lib/businesses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: CreateBusinessState = {};

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(
    createBusiness,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Business name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Bean & Brew Coffee"
          autoFocus
          required
        />
      </div>
      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating…" : "Create business"}
      </Button>
    </form>
  );
}
