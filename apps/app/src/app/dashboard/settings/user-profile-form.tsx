"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "@/lib/auth/profile-actions";
import { Button } from "@stamply/ui/button";
import { Input } from "@stamply/ui/input";
import { Label } from "@stamply/ui/label";
import { useTranslations } from "@stamply/i18n/provider";

const initialState: ProfileState = {};

export function UserProfileForm({
  email,
  fullName,
}: {
  email: string;
  fullName: string;
}) {
  const dict = useTranslations();
  const [state, formAction, pending] = useActionState(
    updateProfile,
    initialState,
  );

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">
          {dict.dashboard.settings.userForm.emailLabel}
        </Label>
        <Input id="email" type="email" defaultValue={email} disabled />
        <p className="text-muted-foreground text-xs">
          {dict.dashboard.settings.userForm.emailHint}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="full_name">
          {dict.dashboard.settings.userForm.nameLabel}
        </Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={fullName}
          placeholder={dict.dashboard.settings.userForm.namePlaceholder}
          maxLength={120}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new_password">
            {dict.dashboard.settings.userForm.newPasswordLabel}
          </Label>
          <Input
            id="new_password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            placeholder={
              dict.dashboard.settings.userForm.newPasswordPlaceholder
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm_password">
            {dict.dashboard.settings.userForm.confirmPasswordLabel}
          </Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            placeholder={
              dict.dashboard.settings.userForm.confirmPasswordPlaceholder
            }
          />
        </div>
      </div>

      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="text-success text-sm" role="status">
          {dict.common.saved}
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? dict.common.saving : dict.common.save}
        </Button>
      </div>
    </form>
  );
}
