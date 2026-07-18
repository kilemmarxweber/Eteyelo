"use client";

import { IconClock } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AttendanceRecentItem } from "../attendance-report-types";

function statusVariant(status: AttendanceRecentItem["status"]) {
  switch (status) {
    case "PRESENT":
      return "success" as const;
    case "ABSENT":
      return "destructive" as const;
    case "LATE":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

export function AttendanceRecentList({ items }: { items: AttendanceRecentItem[] }) {
  return (
    <Card className="border-0 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <IconClock size={18} className="text-primary" />
        <h3 className="font-semibold">Dernieres presences enregistrees</h3>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune presence enregistree.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/20 px-4 py-3 text-sm"
            >
              <span className="font-medium text-muted-foreground">{item.dateLabel}</span>
              <span className="font-semibold">{item.name}</span>
              <span className="font-mono text-muted-foreground">{item.timeLabel}</span>
              <Badge variant={statusVariant(item.status)}>{item.statusLabel}</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
