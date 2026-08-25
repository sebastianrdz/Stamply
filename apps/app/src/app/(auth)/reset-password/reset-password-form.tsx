"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  resetPassword,
  type ResetPasswordState,
} from "@/lib/auth/actions";
import { Button, buttonVariants } from "@stamply/ui/button";
import { Input } from "@stamply/ui/input";
import { Label } from "@stamply/ui/label";
import { cn } from "@stamply/ui/utils";
import { useTranslations } from "@stamply/i18n/provider";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm() {
  const dict = useTranslations();
  const [state, formAction, pending] = useActionState(
    resetPassword,
    initialState,
  );

  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-lg font-semibold">
          {dict.auth.resetPassword.success.title}
        </h2>
        <p className="text-muted-foreground text-sm">
          {dict.auth.resetPassword.success.description}
        </p>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ size: "lg" }), "mt-2 w-full")}
        >
          {dict.auth.resetPassword.success.cta}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">
          {dict.auth.resetPassword.form.passwordLabel}
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm_password">
          {dict.auth.resetPassword.form.confirmPasswordLabel}
        </Label>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
        />
      </div>

      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="mt-2">
        {pending
          ? dict.auth.resetPassword.form.saving
          : dict.auth.resetPassword.form.submit}
      </Button>
    </form>
  );
}
