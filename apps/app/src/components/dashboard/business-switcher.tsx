"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { setActiveBusiness } from "@/lib/businesses/actions";
import { cn } from "@stamply/ui/utils";
import { useTranslations } from "@stamply/i18n/provider";
import type { PlanTier } from "@/types/database";

interface Option {
  id: string;
  name: string;
  plan: PlanTier;
}

export function BusinessSwitcher({
  businesses,
  activeId,
}: {
  businesses: Option[];
  activeId: string;
}) {
  const dict = useTranslations();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = businesses.find((b) => b.id === activeId) ?? businesses[0];

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="border-border bg-background hover:bg-muted flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
      >
        <span className="truncate">
          {active?.name ?? dict.nav.selectBusiness}
        </span>
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
      </button>

      {open && (
        <div className="border-border bg-popover absolute z-20 mt-1 w-full overflow-hidden rounded-lg border p-1 shadow-lg">
          {businesses.map((b) => (
            <form key={b.id} action={setActiveBusiness.bind(null, b.id)}>
              <button
                type="submit"
                className={cn(
                  "hover:bg-muted flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm",
                  b.id === activeId && "font-medium",
                )}
              >
                <span className="truncate">{b.name}</span>
                {b.id === activeId && <Check className="text-primary size-4" />}
              </button>
            </form>
          ))}
          <Link
            href="/onboarding?add=1"
            className="border-border text-muted-foreground hover:bg-muted mt-1 flex items-center gap-2 rounded-md border-t px-2 py-1.5 text-sm"
          >
            <Plus className="size-4" />
            {dict.nav.addBusiness}
          </Link>
        </div>
      )}
    </div>
  );
}
