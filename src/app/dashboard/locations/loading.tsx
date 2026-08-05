import {
  PageHeaderSkeleton,
  CardSectionSkeleton,
  IconRowSkeleton,
} from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mb-6">
        <CardSectionSkeleton titleWidth="w-28" lines={2} />
      </div>
      <div className="flex flex-col gap-3">
        <IconRowSkeleton />
        <IconRowSkeleton />
        <IconRowSkeleton />
      </div>
    </>
  );
}
