import {
  CardSectionSkeleton,
  PageHeaderSkeleton,
} from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton action />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem_minmax(0,1fr)]">
        <CardSectionSkeleton lines={6} />
        <CardSectionSkeleton lines={8} />
        <CardSectionSkeleton lines={5} />
      </div>
    </>
  );
}
