import { PageHeaderSkeleton } from "@/components/dashboard/skeletons";
import { Skeleton } from "@stamply/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-md">
      <PageHeaderSkeleton />
      <Skeleton className="aspect-square w-full rounded-xl" />
    </div>
  );
}
