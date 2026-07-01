import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  change: string;
  icon: LucideIcon;
  bgColor: string;
  iconColor: string;
}

export function StatCard({
  title,
  value,
  change,
  icon: Icon,
  bgColor,
  iconColor,
}: StatCardProps) {
  return (
    <Card
      className="
        relative
        overflow-hidden
        border-0
        shadow-sm
        hover:shadow-lg
        transition-all
        duration-300
        p-5
      "
    >
      <div className={`absolute inset-0 opacity-40 ${bgColor}`} />

      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
          </div>

          <div
            className={`
              h-10 w-10 rounded-full
              flex items-center justify-center
              border
              ${iconColor}
            `}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <h2 className="mt-5 text-4xl font-bold tracking-tight">{value}</h2>

        <p className="mt-2 text-xs text-muted-foreground">{change}</p>
      </div>
    </Card>
  );
}
