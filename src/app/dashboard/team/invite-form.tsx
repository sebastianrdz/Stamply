"use client";

import { useActionState, useState } from "react";
import { createInvitation, type InviteState } from "@/lib/team/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CopyButton } from "@/components/copy-button";

const initialState: InviteState = {};

export function InviteForm() {
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
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="teammate@business.com"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-40">
          <Label htmlFor="role">Role</Label>
          <Select id="role" name="role" defaultValue="employee">
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create invite"}
        </Button>
      </form>

      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}

      {state.path && (
        <div className="border-border bg-muted/40 flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-sm font-medium">Invite link ready</p>
          <p className="text-muted-foreground text-xs">
            Share this link with your teammate. It expires in 7 days and works
            once, for the invited email.
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
