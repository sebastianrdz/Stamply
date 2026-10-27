import type { CardKind } from "./landing-data";

/**
 * Decorative CSS-drawn wallet card. Content is language-neutral (numbers and
 * shapes only); the accessible description lives in the surrounding copy, or
 * in `label` when the mock stands alone.
 */
export function CardMock({
  kind,
  primary,
  secondary,
  label,
}: {
  kind: CardKind;
  primary: string;
  secondary: string;
  label?: string;
}) {
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="relative aspect-[8/5] w-full overflow-hidden rounded-2xl p-4 shadow-md sm:p-5"
      style={{ backgroundColor: primary, color: secondary }}
    >
      <div aria-hidden className="flex h-full flex-col justify-between">
        <span
          className="size-5 rounded-full"
          style={{ backgroundColor: secondary, opacity: 0.9 }}
        />
        {kind === "stamp" && (
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className="aspect-square rounded-full border-2"
                style={{
                  borderColor: secondary,
                  backgroundColor: i < 6 ? secondary : "transparent",
                }}
              />
            ))}
          </div>
        )}
        {kind === "points" && (
          <div>
            <p className="text-3xl leading-none font-bold tabular-nums">
              140<span className="ml-1 text-sm font-medium opacity-80">pts</span>
            </p>
            <div
              className="mt-3 h-2 rounded-full"
              style={{ backgroundColor: `${secondary}33` }}
            >
              <div
                className="h-full w-[70%] rounded-full"
                style={{ backgroundColor: secondary }}
              />
            </div>
          </div>
        )}
        {kind === "coupon" && (
          <div className="flex items-center gap-3">
            <p className="text-4xl leading-none font-bold">20%</p>
            <span
              className="h-10 border-l-2 border-dashed"
              style={{ borderColor: secondary }}
            />
            <p className="text-sm font-semibold tabular-nums">3 / 3</p>
          </div>
        )}
        {kind === "membership" && (
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl leading-none font-bold tracking-wider">GOLD</p>
              <p className="mt-1 text-xs tabular-nums opacity-80">12 / 31</p>
            </div>
            <div className="grid grid-cols-4 gap-0.5">
              {[1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 1].map((on, i) => (
                <span
                  key={i}
                  className="size-2 rounded-[1px]"
                  style={{ backgroundColor: on ? secondary : "transparent" }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
