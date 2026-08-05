import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Mirrors PageHeader's title/description/action layout while data loads. */
export function PageHeaderSkeleton({ action }: { action?: boolean } = {}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {action && <Skeleton className="h-9 w-36 rounded-lg" />}
    </div>
  );
}

/** Mirrors a single StatCard: icon tile + label + value. */
export function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <Skeleton className="size-11 shrink-0 rounded-lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-14" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Mirrors the `grid grid-cols-2 gap-4 lg:grid-cols-4` StatCard grid. */
export function StatsGridSkeleton({ count = 4 }: { count?: number } = {}) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Mirrors a single divided list row, e.g. the Customers list. */
export function ListRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3.5 w-52" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
    </div>
  );
}

/** Mirrors a Card wrapping `divide-y` rows, e.g. the Customers list. */
export function ListCardSkeleton({ rows = 5 }: { rows?: number } = {}) {
  return (
    <Card>
      <CardContent className="divide-border divide-y p-0">
        {Array.from({ length: rows }).map((_, i) => (
          <ListRowSkeleton key={i} />
        ))}
      </CardContent>
    </Card>
  );
}

/** Mirrors a standalone row Card with a leading icon tile, e.g. Locations. */
export function IconRowSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3.5 w-44" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="size-9 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Mirrors an icon-tile + title/description + full-width CTA card, e.g. Overview's action cards. */
export function ActionCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3.5 w-40" />
          </div>
        </div>
        <Skeleton className="h-9 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

/** Mirrors a program card: title/badge, description, reward box, and CTA. */
export function ProgramCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-6">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

/** Mirrors a Card with a CardHeader title and a few form/content-shaped lines. */
export function CardSectionSkeleton({
  titleWidth = "w-32",
  lines = 3,
}: { titleWidth?: string; lines?: number } = {}) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className={cn("h-5", titleWidth)} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-lg" />
        ))}
      </CardContent>
    </Card>
  );
}

/** Mirrors a single usage stat with a progress bar, e.g. Billing's usage grid. */
export function UsageStatSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-10" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  );
}
