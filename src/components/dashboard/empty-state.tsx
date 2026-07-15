import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <div className="bg-muted text-muted-foreground grid size-12 place-items-center rounded-full">
          <Icon className="size-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-muted-foreground max-w-sm text-sm">
            {description}
          </p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
