"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
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
import { cn } from "@stamply/ui/utils";
import type { Program, ProgramType } from "@/types/database";
import {
  MAX_TIERS,
  buildConfig,
  draftFromConfig,
  type ConfigDraft,
} from "@/lib/programs/config";

const initialState: ProgramFormState = {};

export function ProgramForm({ program }: { program?: Program }) {
  const dict = useTranslations();
  const [state, formAction, pending] = useActionState(
    program ? updateProgram.bind(null, program.id) : createProgram,
    initialState,
  );
  const [type, setType] = useState<ProgramType>(
    program?.type ?? "stamp",
  );
  const [draft, setDraft] = useState<ConfigDraft>(() =>
    draftFromConfig(program?.config),
  );
  const f = dict.dashboard.programs.form;
  const set = (patch: Partial<ConfigDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));
  const hasGoal = type === "stamp" || type === "points";
  const types: { value: ProgramType; label: string; hint: string }[] = [
    { value: "stamp", label: f.typeStamp, hint: f.typeStampHint },
    { value: "points", label: f.typePoints, hint: f.typePointsHint },
    { value: "coupon", label: f.typeCoupon, hint: f.typeCouponHint },
    { value: "membership", label: f.typeMembership, hint: f.typeMembershipHint },
  ];

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">{f.nameLabel}</Label>
        <Input
          id="name"
          name="name"
          placeholder={f.namePlaceholder}
          defaultValue={program?.name}
          autoFocus
          required
        />
      </div>

      <fieldset className="flex flex-col gap-1.5" disabled={!!program}>
        <legend className="mb-1.5 text-sm font-medium">{f.typeLabel}</legend>
        <div className="grid grid-cols-2 gap-2">
          {types.map((t) => (
            <label
              key={t.value}
              className={cn(
                "border-border has-[:checked]:border-primary has-[:checked]:bg-muted has-[:focus-visible]:ring-ring flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 has-[:focus-visible]:ring-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
              )}
            >
              <input
                type="radio"
                name="type"
                value={t.value}
                checked={type === t.value}
                onChange={() => setType(t.value)}
                className="sr-only"
              />
              <span className="text-sm font-medium">{t.label}</span>
              <span className="text-muted-foreground text-xs">{t.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {hasGoal ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal">
            {type === "points" ? f.goalLabelPoints : f.goalLabelStamps}
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
      ) : (
        // Coupon/membership don't accumulate: goal is fixed at 1.
        <input type="hidden" name="goal" value={1} />
      )}

      {type === "points" && (
        <fieldset className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="earn">{f.earnLabel}</Label>
              <Select
                id="earn"
                value={draft.earn}
                onChange={(e) => set({ earn: e.target.value as ConfigDraft["earn"] })}
              >
                <option value="visit">{f.earnVisit}</option>
                <option value="spend">{f.earnSpend}</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="points_per_unit">
                {draft.earn === "spend" ? f.pointsPerSpend : f.pointsPerVisit}
              </Label>
              <Input
                id="points_per_unit"
                type="number"
                min={0.01}
                step="any"
                value={draft.pointsPerUnit}
                onChange={(e) => set({ pointsPerUnit: e.target.value })}
                required
              />
            </div>
          </div>
          <Repeater
            label={f.tiersLabel}
            hint={f.tiersHint}
            addLabel={f.tierAdd}
            removeLabel={f.tierRemove}
            rows={draft.pointTiers}
            onChange={(pointTiers) => set({ pointTiers })}
            blank={{ points: "", reward: "" }}
            fields={[
              { key: "points", label: f.tierPointsLabel, type: "number", className: "w-24" },
              { key: "reward", label: f.tierRewardLabel, placeholder: f.tierRewardPlaceholder },
            ]}
          />
        </fieldset>
      )}

      {type === "coupon" && (
        <fieldset className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="discount_kind">{f.discountKindLabel}</Label>
              <Select
                id="discount_kind"
                value={draft.discountKind}
                onChange={(e) =>
                  set({ discountKind: e.target.value as ConfigDraft["discountKind"] })
                }
              >
                <option value="percent">{f.discountPercent}</option>
                <option value="fixed">{f.discountFixed}</option>
                <option value="item">{f.discountItem}</option>
              </Select>
            </div>
            {draft.discountKind !== "item" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="discount_value">{f.discountValueLabel}</Label>
                <Input
                  id="discount_value"
                  type="number"
                  min={0.01}
                  max={draft.discountKind === "percent" ? 100 : undefined}
                  step="any"
                  value={draft.value}
                  onChange={(e) => set({ value: e.target.value })}
                  required
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="max_uses">{f.maxUsesLabel}</Label>
              <Input
                id="max_uses"
                type="number"
                min={1}
                step={1}
                placeholder={f.unlimitedPlaceholder}
                value={draft.maxUses}
                onChange={(e) => set({ maxUses: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="valid_days">{f.validDaysLabel}</Label>
              <Input
                id="valid_days"
                type="number"
                min={1}
                step={1}
                placeholder={f.neverPlaceholder}
                value={draft.validDays}
                onChange={(e) => set({ validDays: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="min_spend">{f.minSpendLabel}</Label>
            <Input
              id="min_spend"
              type="number"
              min={0}
              step="any"
              value={draft.minSpend}
              onChange={(e) => set({ minSpend: e.target.value })}
            />
          </div>
        </fieldset>
      )}

      {type === "membership" && (
        <fieldset className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="access">{f.accessLabel}</Label>
              <Select
                id="access"
                value={draft.access}
                onChange={(e) => set({ access: e.target.value as ConfigDraft["access"] })}
              >
                <option value="free">{f.accessFree}</option>
                <option value="staff_activated">{f.accessStaff}</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="renew_days">{f.renewDaysLabel}</Label>
              <Input
                id="renew_days"
                type="number"
                min={1}
                step={1}
                value={draft.renewDays}
                onChange={(e) => set({ renewDays: e.target.value })}
                required
              />
            </div>
          </div>
          <Repeater
            label={f.memberTiersLabel}
            addLabel={f.memberTierAdd}
            removeLabel={f.tierRemove}
            rows={draft.memberTiers}
            onChange={(memberTiers) => set({ memberTiers })}
            blank={{ name: "", benefits: "" }}
            fields={[
              { key: "name", label: f.memberTierName, className: "w-32" },
              { key: "benefits", label: f.memberTierBenefits },
            ]}
          />
        </fieldset>
      )}

      <input
        type="hidden"
        name="config"
        value={JSON.stringify(buildConfig(type, draft))}
      />

      {program && hasGoal && (
        <p className="text-muted-foreground text-xs">
          {dict.dashboard.programs.edit.goalChangeHint}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reward_description">
          {type === "coupon"
            ? f.rewardLabelCoupon
            : type === "membership"
              ? f.rewardLabelMembership
              : f.rewardLabel}
        </Label>
        <Input
          id="reward_description"
          name="reward_description"
          placeholder={
            type === "coupon"
              ? f.rewardPlaceholderCoupon
              : type === "membership"
                ? f.rewardPlaceholderMembership
                : f.rewardPlaceholder
          }
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

interface RepeaterField {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
  className?: string;
}

/** Add/remove list of small rows (points tiers, membership tiers). */
function Repeater<R extends Record<string, string>>({
  label,
  hint,
  addLabel,
  removeLabel,
  rows,
  onChange,
  blank,
  fields,
}: {
  label: string;
  hint?: string;
  addLabel: string;
  removeLabel: string;
  rows: R[];
  onChange: (rows: R[]) => void;
  blank: R;
  fields: RepeaterField[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      {rows.map((row, i) => (
        <div key={i} className="flex items-end gap-2">
          {fields.map((fld) => (
            <div
              key={fld.key}
              className={cn("flex min-w-0 flex-col gap-1", fld.className ?? "flex-1")}
            >
              <span className="text-muted-foreground text-xs">{fld.label}</span>
              <Input
                type={fld.type}
                min={fld.type === "number" ? 1 : undefined}
                placeholder={fld.placeholder}
                value={row[fld.key]}
                aria-label={fld.label}
                onChange={(e) =>
                  onChange(
                    rows.map((r, j) =>
                      j === i ? { ...r, [fld.key]: e.target.value } : r,
                    ),
                  )
                }
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={removeLabel}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      {rows.length < MAX_TIERS && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start gap-1"
          onClick={() => onChange([...rows, blank])}
        >
          <Plus className="size-4" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}
