"use client";

import { useMemo, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconClock } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AttendanceRecentItem } from "../attendance-report-types";

const PAGE_SIZE = 2;

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
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  const pageItems = useMemo(
    () =>
      items.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [items, safePage],
  );

  return (
    <Card className="border-0 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IconClock size={18} className="text-primary" />
          <h3 className="font-semibold">Dernieres presences enregistrees</h3>
        </div>
        {items.length > PAGE_SIZE ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              disabled={safePage === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              <IconChevronLeft className="size-4" />
            </Button>
            <span className="min-w-16 text-center text-xs text-muted-foreground">
              {safePage + 1}/{totalPages}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              disabled={safePage + 1 >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              <IconChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune presence enregistree.</p>
      ) : (
        <div className="grid gap-3">
          {pageItems.map((item) => (
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
