import {
  PageHeaderSkeleton,
  ListCardSkeleton,
} from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <ListCardSkeleton rows={8} />
    </>
  );
}
