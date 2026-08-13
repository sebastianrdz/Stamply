"use client";

import { useActionState } from "react";
import { acceptInvitation, type AcceptState } from "@/lib/team/actions";
import { Button } from "@stamply/ui/button";
import { useTranslations } from "@stamply/i18n/provider";
import { interpolate } from "@stamply/i18n/format";

const initialState: AcceptState = {};

export function AcceptInvite({
  token,
  businessName,
}: {
  token: string;
  businessName: string;
}) {
  const dict = useTranslations();
  const [state, formAction, pending] = useActionState(
    acceptInvitation,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending
          ? dict.join.joining
          : interpolate(dict.join.joinCta, { business: businessName })}
      </Button>
      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
