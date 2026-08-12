import {
  PageHeaderSkeleton,
  CardSectionSkeleton,
} from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mb-6">
        <CardSectionSkeleton titleWidth="w-28" lines={2} />
      </div>
      <CardSectionSkeleton titleWidth="w-32" lines={3} />
    </>
  );
}
