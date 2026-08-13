import {
  PageHeaderSkeleton,
  ProgramCardSkeleton,
} from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton action />
      <div className="grid gap-4 sm:grid-cols-2">
        <ProgramCardSkeleton />
        <ProgramCardSkeleton />
        <ProgramCardSkeleton />
        <ProgramCardSkeleton />
      </div>
    </>
  );
}
