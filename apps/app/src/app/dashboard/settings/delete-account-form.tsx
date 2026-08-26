"use client";

import { useActionState, useRef, useState } from "react";
import {
  deleteAccount,
  type DeleteAccountState,
} from "@/lib/auth/profile-actions";
import { useTranslations } from "@stamply/i18n/provider";
import { Button } from "@stamply/ui/button";
import { Input } from "@stamply/ui/input";
import { Label } from "@stamply/ui/label";

const CONFIRM_TOKEN = "DELETE";

const initialState: DeleteAccountState = {};

const HEADING_ID = "delete-account-dialog-heading";

export function DeleteAccountForm({
  ownsBusiness = false,
}: {
  ownsBusiness?: boolean;
}) {
  const dict = useTranslations();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmValue, setConfirmValue] = useState("");
  const [state, formAction, pending] = useActionState(
    deleteAccount,
    initialState,
  );

  function resetAndClose() {
    dialogRef.current?.close();
  }

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold">
        {dict.dashboard.settings.dangerZone.account.heading}
      </h4>
      {ownsBusiness && (
        <p className="text-muted-foreground text-sm">
          {dict.dashboard.settings.dangerZone.account.ownsBusinessHint}
        </p>
      )}
      <div>
        <Button
          type="button"
          variant="destructive"
          onClick={() => dialogRef.current?.showModal()}
        >
          {dict.dashboard.settings.dangerZone.account.cta}
        </Button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={HEADING_ID}
        className="delete-account-dialog border-border bg-card text-card-foreground m-auto w-full max-w-md rounded-xl border p-6 shadow-lg"
        onClose={() => setConfirmValue("")}
      >
        <h2 id={HEADING_ID} className="text-lg font-semibold tracking-tight">
          {dict.dashboard.settings.dangerZone.account.heading}
        </h2>

        <div className="bg-destructive/10 text-destructive mt-4 rounded-lg p-3 text-sm">
          {dict.dashboard.settings.dangerZone.account.warning}
        </div>

        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delete-account-confirm">
              {dict.dashboard.settings.dangerZone.account.confirmLabel}
            </Label>
            <Input
              id="delete-account-confirm"
              name="confirm"
              placeholder={
                dict.dashboard.settings.dangerZone.account.confirmPlaceholder
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
              disabled={confirmValue !== CONFIRM_TOKEN || pending}
            >
              {pending
                ? dict.dashboard.settings.dangerZone.account.deleting
                : dict.dashboard.settings.dangerZone.account.confirmButton}
            </Button>
          </div>
        </form>
      </dialog>

      <style>{`
        .delete-account-dialog::backdrop {
          background-color: hsl(224 24% 12% / 0.6);
        }
      `}</style>
    </div>
  );
}
