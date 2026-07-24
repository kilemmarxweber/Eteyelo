"use client";

import {
  CalendarCheck,
  CheckCircle2,
  type LucideIcon,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { BranchStatCard } from "@/components/ui/branch-stat-card";
import type { AttendanceReportStats } from "../attendance-report-types";

type StatCardConfig = {
  title: string;
  value: number;
  icon: LucideIcon;
};

function buildStatCards(stats: AttendanceReportStats): StatCardConfig[] {
  return [
    {
      title: "Enregistrements",
      value: stats.records,
      icon: CalendarCheck,
    },
    {
      title: "Présences",
      value: stats.presences,
      icon: CheckCircle2,
    },
    {
      title: "Absences",
      value: stats.absences,
      icon: UserX,
    },
    {
      title: "Ont pointé",
      value: stats.checkedIn,
      icon: Users,
    },
    {
      title: "N'ont pas pointé",
      value: stats.notCheckedIn,
      icon: UserCheck,
    },
  ];
}

export function AttendanceStatCards({
  stats,
}: {
  stats: AttendanceReportStats;
}) {
  const cards = buildStatCards(stats);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <BranchStatCard
          key={card.title}
          label={card.title}
          value={card.value}
          icon={card.icon}
        />
      ))}
    </div>
  );
}
