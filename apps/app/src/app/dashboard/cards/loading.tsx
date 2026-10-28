import {
  PageHeaderSkeleton,
  ProgramCardSkeleton,
} from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton action />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <ProgramCardSkeleton />
        <ProgramCardSkeleton />
        <ProgramCardSkeleton />
        <ProgramCardSkeleton />
      </div>
    </>
  );
}
