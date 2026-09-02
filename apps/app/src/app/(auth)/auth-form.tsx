"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn, signUp, type AuthState } from "@/lib/auth/actions";
import { Button } from "@stamply/ui/button";
import { Input } from "@stamply/ui/input";
import { Label } from "@stamply/ui/label";
import { useTranslations } from "@stamply/i18n/provider";
import { interpolateNodes } from "@stamply/i18n/format";
import { termsUrl, privacyUrl } from "@/lib/urls";

const initialState: AuthState = {};

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const dict = useTranslations();
  const action = mode === "login" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, initialState);
  const next = useSearchParams().get("next") ?? "/dashboard";

  if (state.checkEmail) {
    return (
      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-lg font-semibold">
          {dict.auth.checkEmail.title}
        </h2>
        <p className="text-muted-foreground text-sm">
          {dict.auth.checkEmail.description}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{dict.auth.form.emailLabel}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={dict.auth.form.emailPlaceholder}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{dict.auth.form.passwordLabel}</Label>
          {mode === "login" && (
            <Link
              href="/forgot-password"
              className="text-muted-foreground text-xs hover:underline"
            >
              {dict.auth.form.forgotPassword}
            </Link>
          )}
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
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
          ? dict.auth.form.pleaseWait
          : mode === "login"
            ? dict.auth.form.signIn
            : dict.auth.form.createAccount}
      </Button>

      {mode === "register" && (
        <p className="text-muted-foreground text-center text-xs">
          {interpolateNodes(dict.auth.form.termsNotice, {
            terms: (
              <Link
                key="terms"
                href={termsUrl()}
                className="text-primary font-medium hover:underline"
              >
                {dict.legal.nav.termsTitle}
              </Link>
            ),
            privacy: (
              <Link
                key="privacy"
                href={privacyUrl()}
                className="text-primary font-medium hover:underline"
              >
                {dict.legal.nav.privacyTitle}
              </Link>
            ),
          })}
        </p>
      )}

      <p className="text-muted-foreground text-center text-sm">
        {mode === "login" ? (
          <>
            {dict.auth.form.newToStamply}{" "}
            <Link
              href="/register"
              className="text-primary font-medium hover:underline"
            >
              {dict.auth.form.createAnAccount}
            </Link>
          </>
        ) : (
          <>
            {dict.auth.form.alreadyHaveAccount}{" "}
            <Link
              href="/login"
              className="text-primary font-medium hover:underline"
            >
              {dict.auth.form.signIn}
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
