"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@stamply/ui/utils";
import { useTranslations } from "@stamply/i18n/provider";
import { BUSINESSES, PROCESS_VISUALS } from "./landing-data";

const INTERVAL_MS = 3500;

/**
 * Auto-advances through `ids` while the section is on screen. Only images that
 * have already been shown are mounted, so the rest never download early.
 * Stays on the first item under prefers-reduced-motion.
 */
function useCycle<T extends string>(ids: readonly T[]) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [seen, setSeen] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const t = setInterval(() => {
      setIndex((i) => {
        const n = (i + 1) % ids.length;
        setSeen((s) => Math.max(s, n + 1));
        return n;
      });
    }, INTERVAL_MS);
    return () => clearInterval(t);
  }, [visible, ids.length]);

  return { ref, active: ids[index], seen: (id: T) => ids.indexOf(id) < seen };
}

/** "Cómo funciona": enrollment / stamp update / proximity. */
export function ProcessSwitcher() {
  const { landing } = useTranslations();
  const { how, images } = landing;
  const { ref, active, seen } = useCycle(PROCESS_VISUALS.map((v) => v.id));

  return (
    <div ref={ref}>
      {/* Fixed stage: switching never changes the page height. */}
      <div className="relative aspect-[3/2] w-full">
        {PROCESS_VISUALS.map(({ id, image }) =>
          seen(id) ? (
            <Image
              key={id}
              src={image}
              alt={images[id]}
              fill
              sizes="(min-width: 1024px) 640px, 100vw"
              aria-hidden={id !== active}
              className={cn(
                "object-contain transition-all duration-1000",
                id === active ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10",
              )}
            />
          ) : null,
        )}
      </div>
      <p
                className="text-muted-foreground mx-auto mt-4 min-h-[6rem] max-w-lg text-center text-sm text-pretty"
      >
        {how.notes[active]}
      </p>
    </div>
  );
}

/** "Ejemplos": Bruma / Alba / Verde Mesa. */
export function ExamplesSwitcher() {
  const { landing } = useTranslations();
  const { examples, images } = landing;
  const { ref, active, seen } = useCycle(BUSINESSES.map((b) => b.id));
  const current = BUSINESSES.find((b) => b.id === active)!;
  const copy = examples.businesses[active];

  return (
    <div ref={ref} className="grid items-start gap-6 lg:grid-cols-[5fr_7fr] lg:gap-14">
      <ul aria-label={examples.selectorLabel} className="flex flex-col">
        {BUSINESSES.map((b) => {
          const on = b.id === active;
          const c = examples.businesses[b.id];
          return (
            <li
              key={b.id}
              aria-current={on}
              className={cn(
                "flex min-h-14 items-center gap-3 border-l-2 py-4 pr-2 pl-4 transition-all duration-1000 lg:min-h-24",
                on ? "text-foreground" : "text-muted-foreground border-transparent",
              )}
              style={on ? { borderColor: b.primary } : undefined}
            >
              <span
                aria-hidden
                className="border-border size-4 shrink-0 rounded-full border"
                style={{
                  background: `linear-gradient(135deg, ${b.primary} 50%, ${b.secondary} 50%)`,
                }}
              />
              <span>
                <span className="block text-base font-semibold lg:text-xl">{c.name}</span>
                <span className="text-muted-foreground block text-sm">
                  {c.style}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <div
        className="rounded-3xl p-6 transition-all duration-1000 sm:p-10"
        style={{ backgroundColor: current.secondary }}
      >
        <div className="relative mx-auto h-[26rem] w-52 sm:h-[32rem] sm:w-64">
          {BUSINESSES.map((b) =>
            seen(b.id) ? (
              <Image
                key={b.id}
                src={b.image}
                alt={images[b.id]}
                fill
                sizes="(min-width: 640px) 256px, 208px"
                aria-hidden={b.id !== active}
                className={cn(
                  "object-contain transition-all duration-1000",
                  b.id === active ? "opacity-100" : "opacity-0",
                )}
              />
            ) : null,
          )}
        </div>
        <div
                    className="mt-6 min-h-[4.5rem] text-center"
          style={{ color: current.primary }}
        >
          <p className="text-lg font-semibold">{copy.name}</p>
          <p className="mt-1 text-sm opacity-90">{copy.detail}</p>
        </div>
      </div>
    </div>
  );
}
