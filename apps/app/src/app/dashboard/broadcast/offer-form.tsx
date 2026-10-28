"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendOffer, type OfferFormState } from "@/lib/offers/actions";
import { useTranslations } from "@stamply/i18n/provider";
import { interpolate } from "@stamply/i18n/format";
import { Button } from "@stamply/ui/button";
import { Label } from "@stamply/ui/label";
import { Textarea } from "@stamply/ui/textarea";
import { toast } from "@stamply/ui/toast";

const initialState: OfferFormState = {};

/** Compose + send an offer. No `customerIds` = every opted-in customer. */
export function OfferForm({
  customerIds = [],
  onSent,
}: {
  customerIds?: string[];
  onSent?: () => void;
}) {
  const dict = useTranslations().dashboard.offers;
  const [state, formAction, pending] = useActionState(sendOffer, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Only fire on a pending -> settled transition (same guard as LocationForm).
  const prevPending = useRef(false);
  useEffect(() => {
    if (prevPending.current && !pending && state.sent !== undefined) {
      formRef.current?.reset();
      toast.success(interpolate(dict.sentToast, { count: state.sent }));
      onSent?.();
    }
    prevPending.current = pending;
  }, [pending, state, dict, onSent]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {customerIds.map((id) => (
        <input key={id} type="hidden" name="customerIds" value={id} />
      ))}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="offer-body">{dict.bodyLabel}</Label>
        <Textarea
          id="offer-body"
          name="body"
          maxLength={200}
          placeholder={dict.bodyPlaceholder}
          required
        />
        <p className="text-muted-foreground text-xs">{dict.consentNote}</p>
      </div>
      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending
          ? dict.sending
          : customerIds.length
            ? interpolate(dict.sendSelected, { count: customerIds.length })
            : dict.sendAll}
      </Button>
    </form>
  );
}
