"use client";

import { useState } from "react";
import { Mail, Phone } from "lucide-react";
import { useTranslations } from "@stamply/i18n/provider";
import { interpolate } from "@stamply/i18n/format";
import { Badge } from "@stamply/ui/badge";
import { Button } from "@stamply/ui/button";
import { Card, CardContent } from "@stamply/ui/card";
import { OfferForm } from "../offers/offer-form";
import type { Customer } from "@/types/database";

/** Customer rows; owners/admins can tick opted-in customers to send an offer. */
export function CustomerList({
  customers,
  canSend,
}: {
  customers: Customer[];
  canSend: boolean;
}) {
  const dict = useTranslations();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <>
      {canSend && (
        <Card className="mb-4">
          <CardContent className="p-4">
            {selected.size === 0 ? (
              <p className="text-muted-foreground text-sm">
                {dict.dashboard.offers.selectCustomers}
              </p>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {interpolate(dict.dashboard.offers.selectedCount, {
                      count: selected.size,
                    })}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(new Set())}
                  >
                    {dict.common.cancel}
                  </Button>
                </div>
                <OfferForm
                  customerIds={[...selected]}
                  onSent={() => setSelected(new Set())}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="divide-border divide-y p-0">
          {customers.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-4 px-5 py-3.5"
            >
              {canSend && (
                <input
                  type="checkbox"
                  className="size-4 shrink-0"
                  checked={selected.has(c.id)}
                  disabled={!c.marketing_consent}
                  onChange={() => toggle(c.id)}
                  aria-label={c.full_name ?? dict.common.anonymous}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {c.full_name ?? dict.common.anonymous}
                </p>
                <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                  {c.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="size-3.5" />
                      {c.email}
                    </span>
                  )}
                  {c.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="size-3.5" />
                      {c.phone}
                    </span>
                  )}
                </div>
              </div>
              {c.marketing_consent ? (
                <Badge variant="success">
                  {dict.dashboard.customers.optedInBadge}
                </Badge>
              ) : (
                <Badge variant="muted">
                  {dict.dashboard.customers.noConsentBadge}
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
