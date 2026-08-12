"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createBusiness,
  type CreateBusinessState,
} from "@/lib/businesses/actions";
import { Button } from "@stamply/ui/button";
import { Input } from "@stamply/ui/input";
import { Label } from "@stamply/ui/label";
import { useTranslations } from "@stamply/i18n/provider";

const initialState: CreateBusinessState = {};

export function OnboardingForm({
  showCancel = false,
}: {
  showCancel?: boolean;
}) {
  const dict = useTranslations();
  const [state, formAction, pending] = useActionState(
    createBusiness,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">{dict.onboarding.form.nameLabel}</Label>
        <Input
          id="name"
          name="name"
          placeholder={dict.onboarding.form.namePlaceholder}
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
        {pending
          ? dict.common.creating
          : showCancel
            ? dict.onboarding.form.addBusiness
            : dict.onboarding.form.createBusiness}
      </Button>
      {showCancel && (
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground text-center text-sm underline-offset-4 hover:underline"
        >
          {dict.onboarding.form.cancel}
        </Link>
      )}
    </form>
  );
}
