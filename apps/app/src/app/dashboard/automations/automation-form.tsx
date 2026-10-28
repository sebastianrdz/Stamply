"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveAutomation, type AutomationFormState } from "@/lib/rewards/actions";
import { CONFIG_FIELDS, configNumber } from "@/lib/automations/config";
import { useTranslations } from "@stamply/i18n/provider";
import { Button } from "@stamply/ui/button";
import { Input } from "@stamply/ui/input";
import { Label } from "@stamply/ui/label";
import { Textarea } from "@stamply/ui/textarea";
import { toast } from "@stamply/ui/toast";
import type { RewardDefinition, RewardType } from "@/types/database";

const initialState: AutomationFormState = {};

export function AutomationForm({
  type,
  definition,
}: {
  type: RewardType;
  definition: RewardDefinition | null;
}) {
  const dict = useTranslations().dashboard.rewards;
  const t = dict.types[type];
  const [state, formAction, pending] = useActionState(saveAutomation, initialState);
  const field = CONFIG_FIELDS[type];

  const prevPending = useRef(false);
  useEffect(() => {
    if (prevPending.current && !pending && state.saved) {
      toast.success(dict.saved);
    }
    prevPending.current = pending;
  }, [pending, state, dict]);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-5">
      <input type="hidden" name="type" value={type} />
      {/* Toggling saves straight away, so turning one on is a single click. */}
      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="active"
          className="border-input mt-0.5 size-4 rounded accent-[hsl(var(--brand))]"
          defaultChecked={definition?.active ?? false}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        />
        <span>{dict.activeLabel}</span>
      </label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`message-${type}`}>{dict.messageLabel}</Label>
        <Textarea
          id={`message-${type}`}
          name="message"
          maxLength={200}
          rows={3}
          defaultValue={definition?.message ?? t.defaultMessage}
        />
        <p className="text-muted-foreground text-xs">{dict.placeholdersHint}</p>
      </div>

      {"warning" in t && (
        <p className="text-muted-foreground text-xs" role="note">
          {t.warning}
        </p>
      )}

      {field && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`setting-${type}`}>{t.settingLabel}</Label>
          <Input
            id={`setting-${type}`}
            name="setting"
            type="number"
            min={field.min}
            max={field.max}
            defaultValue={configNumber(type, definition?.config)}
            className="w-28"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`reward-${type}`}>{dict.rewardLabel}</Label>
        <Input
          id={`reward-${type}`}
          name="reward_description"
          placeholder={dict.rewardPlaceholder}
          defaultValue={definition?.reward_description ?? ""}
          maxLength={200}
        />
      </div>

      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? dict.saving : dict.save}
        </Button>
      </div>
    </form>
  );
}
