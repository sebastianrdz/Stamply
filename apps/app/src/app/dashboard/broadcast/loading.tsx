import {
  PageHeaderSkeleton,
  CardSectionSkeleton,
} from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <CardSectionSkeleton titleWidth="w-28" lines={3} />
    </>
  );
}
