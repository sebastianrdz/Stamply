import {
  PageHeaderSkeleton,
  ListCardSkeleton,
} from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton action />
      <ListCardSkeleton rows={6} />
    </>
  );
}
