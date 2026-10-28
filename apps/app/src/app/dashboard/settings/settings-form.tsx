"use client";

import { useActionState } from "react";
import {
  updateBusiness,
  type SettingsState,
} from "@/lib/businesses/settings-actions";
import { Button } from "@stamply/ui/button";
import { Input } from "@stamply/ui/input";
import { Label } from "@stamply/ui/label";
import { Select } from "@stamply/ui/select";
import { useTranslations } from "@stamply/i18n/provider";
import type { Business } from "@/types/database";

const initialState: SettingsState = {};

export function SettingsForm({ business }: { business: Business }) {
  const dict = useTranslations();
  const bf = dict.dashboard.settings.businessForm;
  const [state, formAction, pending] = useActionState(
    updateBusiness,
    initialState,
  );

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 text-sm font-medium">
          {bf.businessInfoHeading}
        </legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">{bf.nameLabel}</Label>
          <Input id="name" name="name" defaultValue={business.name} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="support_email">{bf.supportEmailLabel}</Label>
          <Input
            id="support_email"
            name="support_email"
            type="email"
            defaultValue={business.support_email ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="support_phone">{bf.supportPhoneLabel}</Label>
          <Input
            id="support_phone"
            name="support_phone"
            type="tel"
            defaultValue={business.support_phone ?? ""}
          />
          <p className="text-muted-foreground text-xs">{bf.supportHint}</p>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 text-sm font-medium">
          {bf.regionalHeading}
        </legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="timezone">{bf.timezoneLabel}</Label>
          <Input
            id="timezone"
            name="timezone"
            defaultValue={business.timezone}
            placeholder={bf.timezonePlaceholder}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="locale">{bf.localeLabel}</Label>
          <Select
            id="locale"
            name="locale"
            defaultValue={business.locale ?? ""}
          >
            <option value="">{bf.localeNone}</option>
            <option value="es">{bf.localeEs}</option>
            <option value="en">{bf.localeEn}</option>
          </Select>
        </div>
      </fieldset>

      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="text-success text-sm" role="status">
          {dict.common.saved}
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? dict.common.saving : dict.common.save}
        </Button>
      </div>
    </form>
  );
}
