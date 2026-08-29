"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  upsertRewardDefinition,
  type RewardDefinitionFormState,
} from "@/lib/rewards/actions";
import { useTranslations } from "@stamply/i18n/provider";
import { Button } from "@stamply/ui/button";
import { Input } from "@stamply/ui/input";
import { Label } from "@stamply/ui/label";
import type { RewardDefinition } from "@/types/database";

const initialState: RewardDefinitionFormState = {};

export function BirthdayRewardForm({
  definition,
}: {
  definition: RewardDefinition | null;
}) {
  const dict = useTranslations();
  const [state, formAction, pending] = useActionState(
    upsertRewardDefinition,
    initialState,
  );

  const [justSaved, setJustSaved] = useState(false);
  const prevPending = useRef(false);
  useEffect(() => {
    if (prevPending.current && !pending && !state.error) {
      setJustSaved(true);
    }
    prevPending.current = pending;
  }, [pending, state]);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-5">
      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="active"
          className="border-input mt-0.5 size-4 rounded accent-[hsl(var(--brand))]"
          defaultChecked={definition?.active ?? false}
        />
        <span>{dict.dashboard.rewards.birthday.activeLabel}</span>
      </label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reward_description">
          {dict.dashboard.rewards.birthday.rewardLabel}
        </Label>
        <Input
          id="reward_description"
          name="reward_description"
          placeholder={dict.dashboard.rewards.birthday.rewardPlaceholder}
          defaultValue={definition?.reward_description}
          required
        />
      </div>

      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}
      {justSaved && !state.error && (
        <p className="text-success text-sm" role="status">
          {dict.dashboard.rewards.birthday.saved}
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending
            ? dict.dashboard.rewards.birthday.saving
            : dict.dashboard.rewards.birthday.save}
        </Button>
      </div>
    </form>
  );
}
