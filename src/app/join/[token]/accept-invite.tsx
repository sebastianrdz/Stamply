"use client";

import { useActionState } from "react";
import { acceptInvitation, type AcceptState } from "@/lib/team/actions";
import { Button } from "@/components/ui/button";

const initialState: AcceptState = {};

export function AcceptInvite({
  token,
  businessName,
}: {
  token: string;
  businessName: string;
}) {
  const [state, formAction, pending] = useActionState(
    acceptInvitation,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Joining…" : `Join ${businessName}`}
      </Button>
      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
