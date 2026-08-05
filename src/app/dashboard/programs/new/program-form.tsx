"use client";

import { useActionState, useState } from "react";
import { createProgram, type ProgramFormState } from "@/lib/programs/actions";
import { useTranslations } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const initialState: ProgramFormState = {};

export function ProgramForm() {
  const dict = useTranslations();
  const [state, formAction, pending] = useActionState(
    createProgram,
    initialState,
  );
  const [type, setType] = useState<"stamp" | "points">("stamp");

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">{dict.dashboard.programs.form.nameLabel}</Label>
        <Input
          id="name"
          name="name"
          placeholder={dict.dashboard.programs.form.namePlaceholder}
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
            max={1000}
            defaultValue={type === "points" ? 100 : 10}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reward_description">
          {dict.dashboard.programs.form.rewardLabel}
        </Label>
        <Input
          id="reward_description"
          name="reward_description"
          placeholder={dict.dashboard.programs.form.rewardPlaceholder}
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
          {pending
            ? dict.dashboard.programs.form.creating
            : dict.dashboard.programs.form.create}
        </Button>
      </div>
    </form>
  );
}
