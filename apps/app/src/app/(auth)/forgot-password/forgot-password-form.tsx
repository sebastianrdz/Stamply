"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordReset,
  type RequestPasswordResetState,
} from "@/lib/auth/actions";
import { Button } from "@stamply/ui/button";
import { Input } from "@stamply/ui/input";
import { Label } from "@stamply/ui/label";
import { useTranslations } from "@stamply/i18n/provider";

const initialState: RequestPasswordResetState = {};

export function ForgotPasswordForm() {
  const dict = useTranslations();
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  if (state.ok) {
    return (
      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-lg font-semibold">
          {dict.auth.forgotPassword.checkEmail.title}
        </h2>
        <p className="text-muted-foreground text-sm">
          {dict.auth.forgotPassword.checkEmail.description}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">
          {dict.auth.forgotPassword.form.emailLabel}
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={dict.auth.forgotPassword.form.emailPlaceholder}
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
          ? dict.auth.forgotPassword.form.sending
          : dict.auth.forgotPassword.form.submit}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        <Link
          href="/login"
          className="text-primary font-medium hover:underline"
        >
          {dict.auth.forgotPassword.form.backToLogin}
        </Link>
      </p>
    </form>
  );
}
