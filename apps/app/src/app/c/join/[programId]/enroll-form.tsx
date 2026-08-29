"use client";

import { useActionState } from "react";
import { enroll, type EnrollState } from "@/lib/enroll/actions";
import { Button } from "@stamply/ui/button";
import { Input } from "@stamply/ui/input";
import { Label } from "@stamply/ui/label";
import { useTranslations } from "@stamply/i18n/provider";

const initialState: EnrollState = {};

export function EnrollForm({ programId }: { programId: string }) {
  const dict = useTranslations();
  const [state, formAction, pending] = useActionState(enroll, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="program_id" value={programId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="full_name">{dict.customerJoin.form.nameLabel}</Label>
        <Input id="full_name" name="full_name" autoFocus required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="birthday">{dict.customerJoin.form.birthdayLabel}</Label>
        <Input id="birthday" name="birthday" type="date" required />
        <p className="text-muted-foreground text-xs">
          {dict.customerJoin.form.birthdayHint}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{dict.customerJoin.form.emailLabel}</Label>
        <Input id="email" name="email" type="email" inputMode="email" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">{dict.customerJoin.form.phoneLabel}</Label>
        <Input id="phone" name="phone" type="tel" inputMode="tel" />
      </div>

      <label className="text-muted-foreground flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="marketing_consent"
          className="border-input mt-0.5 size-4 rounded accent-[hsl(var(--brand))]"
        />
        <span>{dict.customerJoin.form.marketingConsent}</span>
      </label>

      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="mt-1 bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))]/90"
      >
        {pending
          ? dict.customerJoin.form.creating
          : dict.customerJoin.form.submit}
      </Button>
    </form>
  );
}
