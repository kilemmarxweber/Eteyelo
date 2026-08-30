"use client";

import {
  CalendarCheck,
  CheckCircle2,
  type LucideIcon,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { BranchStatCard } from "@/components/ui/branch-stat-card";
import type { AttendanceReportStats } from "../attendance-report-types";

type StatCardConfig = {
  title: string;
  value: number;
  icon: LucideIcon;
};

export function AttendanceStatCards({
  stats,
}: {
  stats: AttendanceReportStats;
}) {
  const t = useTranslations("attendance");

  const cards: StatCardConfig[] = [
    {
      title: t("stats.records"),
      value: stats.records,
      icon: CalendarCheck,
    },
    {
      title: t("stats.presences"),
      value: stats.presences,
      icon: CheckCircle2,
    },
    {
      title: t("stats.absences"),
      value: stats.absences,
      icon: UserX,
    },
    {
      title: t("stats.checkedIn"),
      value: stats.checkedIn,
      icon: Users,
    },
    {
      title: t("stats.notCheckedIn"),
      value: stats.notCheckedIn,
      icon: UserCheck,
    },
  ];

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
