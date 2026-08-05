import {
  PageHeaderSkeleton,
  UsageStatSkeleton,
} from "@/components/dashboard/skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-40 rounded-lg" />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UsageStatSkeleton />
          <UsageStatSkeleton />
          <UsageStatSkeleton />
          <UsageStatSkeleton />
        </CardContent>
      </Card>
      <Skeleton className="mb-4 h-6 w-20" />
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    </>
  );
}
