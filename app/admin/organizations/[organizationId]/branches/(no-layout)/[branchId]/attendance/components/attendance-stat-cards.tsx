"use client";

import {
  CalendarCheck,
  CheckCircle2,
  LucideIcon,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AttendanceReportStats } from "../attendance-report-types";

type StatCardConfig = {
  title: string;
  value: number;
  icon: LucideIcon;
  bgColor: string;
  iconColor: string;
};

function buildStatCards(stats: AttendanceReportStats): StatCardConfig[] {
  return [
    {
      title: "Enregistrements",
      value: stats.records,
      icon: CalendarCheck,
      bgColor: "bg-blue-50",
      iconColor: "bg-blue-100 text-blue-600 border-blue-200",
    },
    {
      title: "Presences",
      value: stats.presences,
      icon: CheckCircle2,
      bgColor: "bg-emerald-50",
      iconColor: "bg-emerald-100 text-emerald-600 border-emerald-200",
    },
    {
      title: "Absences",
      value: stats.absences,
      icon: UserX,
      bgColor: "bg-red-50",
      iconColor: "bg-red-100 text-red-600 border-red-200",
    },
    {
      title: "Ont pointe",
      value: stats.checkedIn,
      icon: Users,
      bgColor: "bg-sky-50",
      iconColor: "bg-sky-100 text-sky-600 border-sky-200",
    },
    {
      title: "N'ont pas pointe",
      value: stats.notCheckedIn,
      icon: UserCheck,
      bgColor: "bg-violet-50",
      iconColor: "bg-violet-100 text-violet-600 border-violet-200",
    },
  ];
}

export function AttendanceStatCards({ stats }: { stats: AttendanceReportStats }) {
  const cards = buildStatCards(stats);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card
            key={card.title}
            className="relative overflow-hidden border-0 p-4 shadow-sm"
          >
            <div className={cn("absolute inset-0 opacity-50", card.bgColor)} />
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {card.title}
                </p>
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full border",
                    card.iconColor,
                  )}
                >
                  <Icon className="size-4" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight">{card.value}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
