import {
  PageHeaderSkeleton,
  ListRowSkeleton,
} from "@/components/dashboard/skeletons";
import { Card, CardContent } from "@stamply/ui/card";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <Card>
        <CardContent className="flex flex-col divide-y p-0">
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
        </CardContent>
      </Card>
    </>
  );
}
