"use client";

import { useActionState, useRef, useState } from "react";
import {
  deleteBusiness,
  type DeleteBusinessState,
} from "@/lib/businesses/delete-actions";
import { useTranslations } from "@stamply/i18n/provider";
import { interpolate } from "@stamply/i18n/format";
import { Button } from "@stamply/ui/button";
import { Input } from "@stamply/ui/input";
import { Label } from "@stamply/ui/label";
import type { Business } from "@/types/database";

const initialState: DeleteBusinessState = {};

const HEADING_ID = "delete-business-dialog-heading";

export function DeleteBusinessForm({ business }: { business: Business }) {
  const dict = useTranslations();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmValue, setConfirmValue] = useState("");
  const [state, formAction, pending] = useActionState(
    deleteBusiness,
    initialState,
  );

  function resetAndClose() {
    dialogRef.current?.close();
  }

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold">
        {dict.dashboard.settings.dangerZone.business.heading}
      </h4>
      <div>
        <Button
          type="button"
          variant="destructive"
          onClick={() => dialogRef.current?.showModal()}
        >
          {dict.dashboard.settings.dangerZone.business.cta}
        </Button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={HEADING_ID}
        className="delete-business-dialog border-border bg-card text-card-foreground m-auto w-full max-w-md rounded-xl border p-6 shadow-lg"
        onClose={() => setConfirmValue("")}
      >
        <h2 id={HEADING_ID} className="text-lg font-semibold tracking-tight">
          {dict.dashboard.settings.dangerZone.business.heading}
        </h2>

        <div className="bg-destructive/10 text-destructive mt-4 rounded-lg p-3 text-sm">
          {dict.dashboard.settings.dangerZone.business.warning}
        </div>

        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delete-business-confirm-name">
              {interpolate(
                dict.dashboard.settings.dangerZone.business.confirmLabel,
                { name: business.name },
              )}
            </Label>
            <Input
              id="delete-business-confirm-name"
              name="confirm_name"
              placeholder={
                dict.dashboard.settings.dangerZone.business.confirmPlaceholder
              }
              value={confirmValue}
              onChange={(e) => setConfirmValue(e.target.value)}
              autoComplete="off"
            />
          </div>

          {state.error && (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={resetAndClose}>
              {dict.common.cancel}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={confirmValue !== business.name || pending}
            >
              {pending
                ? dict.dashboard.settings.dangerZone.business.deleting
                : dict.dashboard.settings.dangerZone.business.confirmButton}
            </Button>
          </div>
        </form>
      </dialog>

      <style>{`
        .delete-business-dialog::backdrop {
          background-color: hsl(224 24% 12% / 0.6);
        }
      `}</style>
    </div>
  );
}
