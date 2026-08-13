import {
  PageHeaderSkeleton,
  StatsGridSkeleton,
} from "@/components/dashboard/skeletons";
import { Skeleton } from "@stamply/ui/skeleton";
import { Card, CardContent, CardHeader } from "@stamply/ui/card";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <StatsGridSkeleton />
      <Card className="mt-6">
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full rounded-lg" />
        </CardContent>
      </Card>
    </>
  );
}
