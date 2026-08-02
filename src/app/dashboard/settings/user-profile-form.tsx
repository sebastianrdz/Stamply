"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "@/lib/auth/profile-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ProfileState = {};

export function UserProfileForm({
  email,
  fullName,
}: {
  email: string;
  fullName: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateProfile,
    initialState,
  );

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" defaultValue={email} disabled />
        <p className="text-muted-foreground text-xs">
          Your sign-in email. Contact support to change it.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="full_name">Name</Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={fullName}
          placeholder="Your name"
          maxLength={120}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new_password">New password</Label>
          <Input
            id="new_password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            placeholder="Leave blank to keep current"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm_password">Confirm password</Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter new password"
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
          Saved.
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
