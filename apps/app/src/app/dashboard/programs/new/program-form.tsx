"use client";

import { useActionState, useState } from "react";
import {
  createProgram,
  updateProgram,
  type ProgramFormState,
} from "@/lib/programs/actions";
import { useTranslations } from "@stamply/i18n/provider";
import { Button } from "@stamply/ui/button";
import { Input } from "@stamply/ui/input";
import { Label } from "@stamply/ui/label";
import { Select } from "@stamply/ui/select";
import type { Program } from "@/types/database";

const initialState: ProgramFormState = {};

export function ProgramForm({ program }: { program?: Program }) {
  const dict = useTranslations();
  const [state, formAction, pending] = useActionState(
    program ? updateProgram.bind(null, program.id) : createProgram,
    initialState,
  );
  const [type, setType] = useState<"stamp" | "points">(
    program?.type ?? "stamp",
  );

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">{dict.dashboard.programs.form.nameLabel}</Label>
        <Input
          id="name"
          name="name"
          placeholder={dict.dashboard.programs.form.namePlaceholder}
          defaultValue={program?.name}
          autoFocus
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="type">{dict.dashboard.programs.form.typeLabel}</Label>
          <Select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as "stamp" | "points")}
          >
            <option value="stamp">
              {dict.dashboard.programs.form.typeStamp}
            </option>
            <option value="points">
              {dict.dashboard.programs.form.typePoints}
            </option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal">
            {type === "points"
              ? dict.dashboard.programs.form.goalLabelPoints
              : dict.dashboard.programs.form.goalLabelStamps}
          </Label>
          <Input
            id="goal"
            name="goal"
            type="number"
            min={1}
            // Stamp cards render at most 10 slots, so stamp goals are capped
            // at 10 (enforced server-side in programSchema too).
            max={type === "stamp" ? 10 : 1000}
            defaultValue={program?.goal ?? (type === "points" ? 100 : 10)}
            required
          />
        </div>
      </div>

      {program && (
        <p className="text-muted-foreground text-xs">
          {dict.dashboard.programs.edit.goalChangeHint}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reward_description">
          {dict.dashboard.programs.form.rewardLabel}
        </Label>
        <Input
          id="reward_description"
          name="reward_description"
          placeholder={dict.dashboard.programs.form.rewardPlaceholder}
          defaultValue={program?.reward_description}
          required
        />
      </div>

      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {program
            ? pending
              ? dict.common.saving
              : dict.common.save
            : pending
              ? dict.dashboard.programs.form.creating
              : dict.dashboard.programs.form.create}
        </Button>
      </div>
    </form>
  );
}
