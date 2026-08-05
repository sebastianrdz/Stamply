"use client";

import { useActionState, useRef, useState } from "react";
import { deleteProgram, type ProgramFormState } from "@/lib/programs/actions";
import { useTranslations } from "@/lib/i18n/provider";
import { interpolate } from "@/lib/i18n/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ProgramFormState = {};

const HEADING_ID = "delete-program-dialog-heading";

export function DeleteProgramDialog({
  programId,
  programName,
  active,
  cardCount,
}: {
  programId: string;
  programName: string;
  active: boolean;
  cardCount: number;
}) {
  const dict = useTranslations();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmValue, setConfirmValue] = useState("");
  const [state, formAction, pending] = useActionState(
    deleteProgram.bind(null, programId),
    initialState,
  );

  function resetAndClose() {
    dialogRef.current?.close();
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="destructive"
          disabled={active}
          onClick={() => dialogRef.current?.showModal()}
        >
          {dict.dashboard.programs.delete.cta}
        </Button>
        {active && (
          <p className="text-muted-foreground text-xs">
            {dict.dashboard.programs.delete.disabledHint}
          </p>
        )}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={HEADING_ID}
        className="delete-program-dialog border-border bg-card text-card-foreground w-full max-w-md rounded-xl border p-6 shadow-lg"
        onClose={() => setConfirmValue("")}
      >
        <h2 id={HEADING_ID} className="text-lg font-semibold tracking-tight">
          {interpolate(dict.dashboard.programs.delete.title, {
            name: programName,
          })}
        </h2>

        <div className="bg-destructive/10 text-destructive mt-4 rounded-lg p-3 text-sm">
          {interpolate(dict.dashboard.programs.delete.warning, {
            count: cardCount,
          })}
        </div>

        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delete-confirm-name">
              {interpolate(dict.dashboard.programs.delete.confirmLabel, {
                name: programName,
              })}
            </Label>
            <Input
              id="delete-confirm-name"
              name="confirm_name"
              placeholder={dict.dashboard.programs.delete.confirmPlaceholder}
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
              disabled={confirmValue !== programName || pending}
            >
              {pending
                ? dict.dashboard.programs.delete.deleting
                : dict.dashboard.programs.delete.confirmButton}
            </Button>
          </div>
        </form>
      </dialog>

      <style>{`
        .delete-program-dialog::backdrop {
          background-color: hsl(224 24% 12% / 0.6);
        }
      `}</style>
    </div>
  );
}
