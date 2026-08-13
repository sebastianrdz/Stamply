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
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
          <circle cx="12" cy="6.8" r="3.1" />
          <path d="M9.3 10.2h5.4l2.7 6.3h-10.8z" />
          <rect x="5.3" y="15.8" width="13.4" height="3.1" rx="1.55" />
          <rect x="7.5" y="20.8" width="9" height="1.5" rx="0.75" />
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
