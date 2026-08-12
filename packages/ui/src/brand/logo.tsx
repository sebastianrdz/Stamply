import { cn } from "../lib/utils";

/** Stamply wordmark with a stamp-style mark. */
export function Logo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg shadow-sm"
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-5">
          <path
            d="M12 3.5c2.5 0 4 1.6 4 3.6 0 1.3-.7 2.2-1.3 3-.4.6-.7 1-.7 1.6 0 .5.4.8 1 .8h1.5A2.2 2.2 0 0 1 18.7 18v.3c0 1.2-1 2.2-2.2 2.2H7.5a2.2 2.2 0 0 1-2.2-2.2V18a2.2 2.2 0 0 1 2.2-2.2H9c.6 0 1-.3 1-.8 0-.6-.3-1-.7-1.6-.6-.8-1.3-1.7-1.3-3 0-2 1.5-3.6 4-3.6Z"
            fill="currentColor"
          />
        </svg>
      </span>
      {showText && (
        <span className="text-foreground text-lg font-bold tracking-tight">
          Stamply
        </span>
      )}
    </span>
  );
}
