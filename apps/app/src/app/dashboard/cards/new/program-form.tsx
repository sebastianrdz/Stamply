"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  createProgram,
  updateProgram,
  type ProgramFormState,
} from "@/lib/programs/actions";
import { useLocale, useTranslations } from "@stamply/i18n/provider";
import { Button } from "@stamply/ui/button";
import { Input } from "@stamply/ui/input";
import { Label } from "@stamply/ui/label";
import { Select } from "@stamply/ui/select";
import { CURRENCIES } from "@/lib/programs/currency";
import { cn } from "@stamply/ui/utils";
import { interpolate } from "@stamply/i18n/format";
import type { Program, ProgramType } from "@/types/database";
import type { CardDesign } from "@/lib/programs/design";
import type { AssetLibrary } from "@/lib/assets/library";
import { AppleWalletCardPreview } from "@stamply/ui/apple-wallet-card-preview";
import { DesignFields, ImageField } from "./design-fields";
import {
  MAX_TIERS,
  buildConfig,
  draftFromConfig,
  newMilestoneId,
  type ConfigDraft,
} from "@/lib/programs/config";

import { cardText } from "@/lib/cards/text";

// Stamp cards render at most 10 slots; extra rewards take the stamps before the last.
const MAX_STAMPS = 10;
const hasGoalOf = (t: ProgramType) => t === "stamp" || t === "points";
const initialState: ProgramFormState = {};

export function ProgramForm({
  program,
  businessName,
  design,
  library,
}: {
  program?: Program;
  businessName: string;
  design: CardDesign;
  library: AssetLibrary;
}) {
  const dict = useTranslations();
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(
    program ? updateProgram.bind(null, program.id) : createProgram,
    initialState,
  );
  const [type, setType] = useState<ProgramType>(program?.type ?? "stamp");
  const [name, setName] = useState(program?.name ?? "");
  const [draft, setDraft] = useState<ConfigDraft>(() => {
    const d = draftFromConfig(program?.config);
    // Legacy single-goal points program: its goal/reward become the first tier.
    if (program?.type === "points" && d.pointTiers.length === 0)
      d.pointTiers = [
        { points: String(program.goal), reward: program.reward_description },
      ];
    return d;
  });
  const [d, setD] = useState(design);
  const [goal, setGoal] = useState(program?.goal ?? 10);
  const [reward, setReward] = useState(program?.reward_description ?? "");
  // Points cards earn by spend: the input is money per point; the config stores points per $1.
  const [spendPerPoint, setSpendPerPoint] = useState(() => {
    const ppu = Number(draft.pointsPerUnit);
    return ppu > 0 ? String(Number((1 / ppu).toPrecision(8))) : "1";
  });
  // Stamps shown as filled in the preview only; never saved.
  const [previewStamps, setPreviewStamps] = useState(3);
  const f = dict.dashboard.programs.form;
  const stepLabels = [f.stepType, f.stepConfig, f.stepDesign];
  const set = (patch: Partial<ConfigDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));
  // Sample card for the chosen type, built by the same code as the real card.
  // Points cards: the first (mandatory) tier is the initial goal and reward.
  const firstTier = draft.pointTiers[0] ?? { points: "", reward: "" };
  const pointsGoal = Number(firstTier.points);
  const goalForType =
    type === "points"
      ? pointsGoal > 0
        ? pointsGoal
        : 1
      : hasGoalOf(type) && goal > 0
        ? goal
        : 1;
  const rewardForType = type === "points" ? firstTier.reward : reward;
  const previewProgress = Math.min(previewStamps, goalForType);
  const config = buildConfig(type, draft);
  const tiers = (config.tiers ?? []) as {
    points: number;
    reward: string;
    name?: string;
  }[];
  const preview = cardText(
    {
      type,
      progress: previewProgress,
      goal: goalForType,
      available: 0,
      nextTier: type === "points" && tiers[0] ? tiers[0] : null,
      usesLeft: typeof config.max_uses === "number" ? config.max_uses : null,
      until:
        type === "coupon" || type === "membership"
          ? "2030-01-01T00:00:00.000Z"
          : null,
      tier: type === "membership" ? (tiers[0]?.name ?? null) : null,
      expired: false,
      actions: [],
    },
    {
      type,
      goal: goalForType,
      reward_description: rewardForType || f.rewardPlaceholder,
      config,
    },
    dict.wallet,
    { locale, business: businessName, rewards: 0 },
  );
  const previewSlotIcons: Record<number, string> = {};
  const previewSlotColors: Record<number, string> = {};
  if (type === "stamp") {
    for (const m of draft.milestones) {
      const at = Number(m.at);
      if (!Number.isInteger(at) || at < 1 || at >= goalForType) continue;
      if (m.iconUrl) previewSlotIcons[at] = m.iconUrl;
      if (m.iconColor) previewSlotColors[at] = m.iconColor;
    }
    if (draft.rewardIconUrl)
      previewSlotIcons[goalForType] = draft.rewardIconUrl;
    if (draft.rewardIconColor)
      previewSlotColors[goalForType] = draft.rewardIconColor;
  }
  // Shown while typing, not only on submit (the server enforces both too).
  const goalTooHigh = type === "stamp" && goal > MAX_STAMPS;
  const milestoneError = (m: (typeof draft.milestones)[number]) => {
    if (m.at === "") return null;
    const at = Number(m.at);
    if (!Number.isInteger(at) || at < 1 || at >= goalForType)
      return interpolate(f.milestoneRange, { goal: goalForType });
    return draft.milestones.some((o) => o.id !== m.id && Number(o.at) === at)
      ? f.milestoneDuplicate
      : null;
  };
  const hasGoal = type === "stamp" || type === "points";
  const types: { value: ProgramType; label: string; hint: string }[] = [
    { value: "stamp", label: f.typeStamp, hint: f.typeStampHint },
    { value: "points", label: f.typePoints, hint: f.typePointsHint },
    { value: "coupon", label: f.typeCoupon, hint: f.typeCouponHint },
    {
      value: "membership",
      label: f.typeMembership,
      hint: f.typeMembershipHint,
    },
  ];

  return (
    <form
      action={formAction}
      className="flex flex-col gap-8 lg:flex-row lg:items-start"
    >
      <div className="flex w-full max-w-lg flex-col gap-5">
        <section className="flex flex-col gap-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="bg-primary text-primary-foreground grid size-6 place-items-center rounded-full text-xs">
              1
            </span>
            {stepLabels[0]}
          </h2>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">{f.nameLabel}</Label>
            <Input
              id="name"
              name="name"
              placeholder={f.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <fieldset className="flex flex-col gap-1.5" disabled={!!program}>
            <legend className="mb-1.5 text-sm font-medium">
              {f.typeLabel}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {types.map((t) => (
                <label
                  key={t.value}
                  className={cn(
                    "border-border has-[:checked]:border-primary has-[:checked]:bg-muted has-[:focus-visible]:ring-ring flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:ring-2",
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
                  <span className="text-muted-foreground text-xs">
                    {t.hint}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="flex flex-col gap-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="bg-primary text-primary-foreground grid size-6 place-items-center rounded-full text-xs">
              2
            </span>
            {stepLabels[1]}
          </h2>
          {type === "stamp" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal">{f.goalLabelStamps}</Label>
              <Input
                id="goal"
                name="goal"
                type="number"
                min={1}
                // Stamp cards render at most 10 slots, so stamp goals are capped
                // at 10 (enforced server-side in programSchema too).
                max={MAX_STAMPS}
                defaultValue={program?.goal ?? 10}
                onChange={(e) => setGoal(Number(e.target.value))}
                aria-invalid={goalTooHigh}
                required
              />
              {goalTooHigh && (
                <p className="text-destructive text-xs" role="alert">
                  {dict.dashboard.programs.errors.stampGoalMax}
                </p>
              )}
            </div>
          ) : (
            // Coupon/membership: goal fixed at 1. Points: the first tier's points.
            <input
              type="hidden"
              name="goal"
              value={type === "points" ? goalForType : 1}
            />
          )}

          {type === "stamp" && (
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-medium">
                {f.milestonesLabel}
              </legend>
              <p className="text-muted-foreground text-xs">
                {f.milestonesHint}
              </p>

              {/* The reward at the last stamp: always present, can't be removed. */}
              <div className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <ImageField
                    compact
                    kind="stamp"
                    name="ms_icon_final"
                    label={f.rewardIconLabel}
                    accept="image/svg+xml"
                    value={draft.rewardIconUrl}
                    library={library.stamp}
                    onChange={(rewardIconUrl) => set({ rewardIconUrl })}
                    color={draft.rewardIconColor}
                    onColorChange={(rewardIconColor) =>
                      set({ rewardIconColor })
                    }
                  />
                  <span className="text-muted-foreground text-sm">
                    {f.rewardAtPrefix}
                  </span>
                  <Input
                    className="w-16"
                    type="number"
                    value={goalForType}
                    disabled
                    aria-label={f.milestoneAtLabel}
                  />
                  <span className="text-muted-foreground text-sm">
                    {f.rewardAtSuffix}
                  </span>
                </div>
                <Input
                  id="reward_description"
                  name="reward_description"
                  aria-label={f.rewardLabel}
                  placeholder={f.rewardPlaceholder}
                  defaultValue={program?.reward_description}
                  onChange={(e) => setReward(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>

              {draft.milestones.map((m, i) => {
                const patch = (p: Partial<typeof m>) =>
                  set({
                    milestones: draft.milestones.map((x) =>
                      x.id === m.id ? { ...x, ...p } : x,
                    ),
                  });
                const error = milestoneError(m);
                return (
                  <div
                    key={m.id}
                    className="flex flex-col gap-2 rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <ImageField
                        compact
                        kind="stamp"
                        name={`ms_icon_${i}`}
                        label={f.milestoneIconLabel}
                        accept="image/svg+xml"
                        value={m.iconUrl}
                        library={library.stamp}
                        onChange={(iconUrl) => patch({ iconUrl })}
                        color={m.iconColor}
                        onColorChange={(iconColor) => patch({ iconColor })}
                      />
                      <span className="text-muted-foreground text-sm">
                        {f.rewardAtPrefix}
                      </span>
                      <Input
                        className="w-16"
                        type="number"
                        min={1}
                        max={Math.max(1, goalForType - 1)}
                        value={m.at}
                        onChange={(e) => patch({ at: e.target.value })}
                        // Also blocks submit natively while the warning shows.
                        ref={(el) => el?.setCustomValidity(error ?? "")}
                        aria-invalid={!!error}
                        aria-label={f.milestoneAtLabel}
                        required
                      />
                      <span className="text-muted-foreground min-w-0 flex-1 text-sm">
                        {f.rewardAtSuffix}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="hover:text-destructive size-8"
                        aria-label={f.milestoneRemove}
                        onClick={() =>
                          set({
                            milestones: draft.milestones.filter(
                              (x) => x.id !== m.id,
                            ),
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <Input
                      value={m.reward}
                      onChange={(e) => patch({ reward: e.target.value })}
                      aria-label={f.milestoneRewardLabel}
                      placeholder={f.milestoneRewardLabel}
                      maxLength={120}
                      required
                    />
                    {error && (
                      <p className="text-destructive text-xs" role="alert">
                        {error}
                      </p>
                    )}
                  </div>
                );
              })}

              {draft.milestones.length < goalForType - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() =>
                    set({
                      milestones: [
                        ...draft.milestones,
                        {
                          id: newMilestoneId(),
                          // First stamp before the last that has no reward yet.
                          at: String(
                            Array.from(
                              { length: goalForType - 1 },
                              (_, k) => k + 1,
                            ).find(
                              (n) =>
                                !draft.milestones.some(
                                  (o) => Number(o.at) === n,
                                ),
                            ) ?? "",
                          ),
                          reward: "",
                          iconUrl: null,
                          iconColor: null,
                        },
                      ],
                    })
                  }
                >
                  <Plus className="size-4" />
                  {f.milestoneAdd}
                </Button>
              )}
            </fieldset>
          )}

          {type === "points" && (
            <fieldset className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="spend_per_point">{f.spendPerPointLabel}</Label>
                <div className="flex gap-2">
                  <Input
                    id="spend_per_point"
                    type="number"
                    min={0.01}
                    step="any"
                    value={spendPerPoint}
                    onChange={(e) => {
                      setSpendPerPoint(e.target.value);
                      const n = Number(e.target.value);
                      set({ pointsPerUnit: n > 0 ? String(1 / n) : "" });
                    }}
                    required
                  />
                  <Select
                    aria-label={f.currencyLabel}
                    className="w-28 shrink-0"
                    value={draft.currency}
                    onChange={(e) => set({ currency: e.target.value })}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <p className="text-muted-foreground text-xs">
                  {f.spendPerPointHint}
                </p>
              </div>
              <Repeater
                label={f.tiersLabel}
                hint={f.tiersHint}
                addLabel={f.tierAdd}
                removeLabel={f.tierRemove}
                rows={draft.pointTiers.length ? draft.pointTiers : [firstTier]}
                minRows={1}
                onChange={(pointTiers) => set({ pointTiers })}
                blank={{ points: "", reward: "" }}
                fields={[
                  {
                    key: "points",
                    label: f.tierPointsLabel,
                    type: "number",
                    className: "w-24",
                  },
                  {
                    key: "reward",
                    label: f.tierRewardLabel,
                    placeholder: f.tierRewardPlaceholder,
                  },
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
                      set({
                        discountKind: e.target
                          .value as ConfigDraft["discountKind"],
                      })
                    }
                  >
                    <option value="percent">{f.discountPercent}</option>
                    <option value="fixed">{f.discountFixed}</option>
                    <option value="item">{f.discountItem}</option>
                  </Select>
                </div>
                {draft.discountKind !== "item" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="discount_value">
                      {f.discountValueLabel}
                    </Label>
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
                    onChange={(e) =>
                      set({ access: e.target.value as ConfigDraft["access"] })
                    }
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

          {type === "points" && (
            <input
              type="hidden"
              name="reward_description"
              value={firstTier.reward}
            />
          )}

          {(type === "coupon" || type === "membership") && (
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
                onChange={(e) => setReward(e.target.value)}
                required
              />
            </div>
          )}
        </section>

        <section className="flex flex-col gap-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="bg-primary text-primary-foreground grid size-6 place-items-center rounded-full text-xs">
              3
            </span>
            {stepLabels[2]}
          </h2>
          <DesignFields
            d={d}
            set={(patch) => setD((x) => ({ ...x, ...patch }))}
            library={library}
            type={type}
          />
        </section>

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
                ? f.creating
                : f.create}
          </Button>
        </div>
      </div>

      {/* Sticky on desktop: <main> is the scroll container, so only the form scrolls. */}
      <aside className="w-full max-w-xs lg:sticky lg:top-6 lg:shrink-0">
        <p className="mb-2 text-sm font-medium">{f.previewTitle}</p>
        <AppleWalletCardPreview
          backgroundColor={d.primary_color}
          logoUrl={d.logo_url}
          logoText={d.show_business_name ? businessName : null}
          headerFields={[preview.header]}
          strip={
            type === "stamp"
              ? {
                  imageUrl: d.background_image_url,
                  overlayOpacity: d.overlay_opacity,
                  stamps: {
                    progress: previewProgress,
                    goal: goalForType,
                    iconUrl: d.stamp_icon_url,
                    iconColor: d.stamp_color,
                    slotIcons: previewSlotIcons,
                    slotColors: previewSlotColors,
                  },
                }
              : d.background_image_url
                ? {
                    imageUrl: d.background_image_url,
                    overlayOpacity: d.overlay_opacity,
                  }
                : null
          }
          primaryField={preview.primary}
          secondaryFields={[
            { label: dict.card.name, value: dict.card.guest },
            ...preview.secondary.map((x) =>
              preview.legacy ? { ...x, value: 0 } : x,
            ),
          ]}
          auxiliaryFields={preview.auxiliary}
        />
        {type === "stamp" && (
          <div className="mt-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="preview_stamps" className="text-xs font-medium">
                {f.previewStampsLabel}
              </label>
              <span className="text-muted-foreground text-xs tabular-nums">
                {previewProgress}/{goalForType}
              </span>
            </div>
            {/* No name: preview-only, not submitted. */}
            <input
              type="range"
              id="preview_stamps"
              min={0}
              max={goalForType}
              step={1}
              value={previewProgress}
              onChange={(e) => setPreviewStamps(Number(e.target.value))}
              className="accent-primary w-full cursor-pointer"
            />
          </div>
        )}
      </aside>
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
  minRows = 0,
}: {
  label: string;
  hint?: string;
  addLabel: string;
  removeLabel: string;
  rows: R[];
  onChange: (rows: R[]) => void;
  blank: R;
  fields: RepeaterField[];
  /** Leading rows that can't be removed. */
  minRows?: number;
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
              className={cn(
                "flex min-w-0 flex-col gap-1",
                fld.className ?? "flex-1",
              )}
            >
              <span className="text-muted-foreground text-xs">{fld.label}</span>
              <Input
                type={fld.type}
                min={fld.type === "number" ? 1 : undefined}
                placeholder={fld.placeholder}
                value={row[fld.key]}
                aria-label={fld.label}
                required={i < minRows}
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
          {i >= minRows && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={removeLabel}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      ))}
      {rows.length < MAX_TIERS && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1 self-start"
          onClick={() => onChange([...rows, blank])}
        >
          <Plus className="size-4" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}
