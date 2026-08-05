"use client";

import { useActionState, useState } from "react";
import { createInvitation, type InviteState } from "@/lib/team/actions";
import { useTranslations } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CopyButton } from "@/components/copy-button";

const initialState: InviteState = {};

export function InviteForm() {
  const dict = useTranslations();
  const [state, formAction, pending] = useActionState(
    createInvitation,
    initialState,
  );

  // Build the absolute invite URL on the client (server action returns a path).
  // The success block below only renders after submit, so this never reaches SSR.
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : "",
  );
  const inviteUrl = state.path ? `${origin}${state.path}` : "";

  return (
    <div className="flex flex-col gap-4">
      <form
        action={formAction}
        className="flex flex-col gap-4 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="email">{dict.dashboard.team.form.emailLabel}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder={dict.dashboard.team.form.emailPlaceholder}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-40">
          <Label htmlFor="role">{dict.dashboard.team.form.roleLabel}</Label>
          <Select id="role" name="role" defaultValue="employee">
            <option value="employee">
              {dict.dashboard.team.form.roleEmployee}
            </option>
            <option value="admin">{dict.dashboard.team.form.roleAdmin}</option>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending
            ? dict.dashboard.team.form.creating
            : dict.dashboard.team.form.createInvite}
        </Button>
      </form>

      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}

      {state.path && (
        <div className="border-border bg-muted/40 flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-sm font-medium">
            {dict.dashboard.team.form.inviteReadyTitle}
          </p>
          <p className="text-muted-foreground text-xs">
            {dict.dashboard.team.form.inviteReadyHint}
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={inviteUrl} className="font-mono text-xs" />
            <CopyButton value={inviteUrl} />
          </div>
        </div>
      )}
    </div>
  );
}
