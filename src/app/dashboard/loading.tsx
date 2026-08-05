import {
  PageHeaderSkeleton,
  StatsGridSkeleton,
  ActionCardSkeleton,
} from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <StatsGridSkeleton />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ActionCardSkeleton />
        <ActionCardSkeleton />
      </div>
    </>
  );
}
