import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-lg">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
