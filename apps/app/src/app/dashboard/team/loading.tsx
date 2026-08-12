import {
  PageHeaderSkeleton,
  CardSectionSkeleton,
  ListRowSkeleton,
} from "@/components/dashboard/skeletons";
import { Card, CardContent, CardHeader } from "@stamply/ui/card";
import { Skeleton } from "@stamply/ui/skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton action />
      <div className="mb-6">
        <CardSectionSkeleton titleWidth="w-40" lines={2} />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-20" />
        </CardHeader>
        <CardContent className="flex flex-col divide-y p-0">
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
        </CardContent>
      </Card>
    </>
  );
}
