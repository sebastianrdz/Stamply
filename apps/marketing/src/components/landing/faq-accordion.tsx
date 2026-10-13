"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@stamply/ui/utils";

/** Single-open accordion; panels animate via grid-template-rows 0fr -> 1fr. */
export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const id = useId();

  return (
    <div className="border-border divide-border divide-y border-y">
      {items.map((item, i) => {
        const on = open === i;
        return (
          <div key={item.q}>
            <h3>
              <button
                type="button"
                id={`${id}-q${i}`}
                aria-expanded={on}
                aria-controls={`${id}-a${i}`}
                onClick={() => setOpen(on ? null : i)}
                className="focus-visible:ring-ring flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 rounded-md py-3 text-left text-base font-medium focus-visible:ring-2 focus-visible:outline-none"
              >
                {item.q}
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "text-muted-foreground size-5 shrink-0 transition-transform duration-200",
                    on && "rotate-180",
                  )}
                />
              </button>
            </h3>
            <div
              id={`${id}-a${i}`}
              role="region"
              aria-labelledby={`${id}-q${i}`}
              className={cn(
                "grid transition-[grid-template-rows,visibility] duration-200 ease-out",
                on ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <p className="text-muted-foreground max-w-2xl pb-5">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
