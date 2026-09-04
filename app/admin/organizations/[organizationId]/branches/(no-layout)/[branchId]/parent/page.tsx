"use client";

import { BranchPageShell } from "@/components/layout/branch-page-shell";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  IconCalendarStats,
  IconSchool,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { BranchStatCard } from "@/components/ui/branch-stat-card";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

import UserList from "./components/ParentsTable";
import { getParentEnrollmentStatsAction } from "./parent.action";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";

type ParentStats = {
  totalParents: number;
  currentYearName: string | null;
  parentsCurrentYear: number;
  enrollmentsCurrentYear: number;
  byYear: Array<{
    yearId: string;
    nameYear: string;
    isCurrentYear: boolean;
    parentsCount: number;
    enrollmentsCount: number;
  }>;
};

const emptyStats: ParentStats = {
  totalParents: 0,
  currentYearName: null,
  parentsCurrentYear: 0,
  enrollmentsCurrentYear: 0,
  byYear: [],
};

export default function Parents() {
  const t = useTranslations("users");
  const [stats, setStats] = useState<ParentStats>(emptyStats);
  const [hasMounted, setHasMounted] = useState(false);
  const peopleLabels = useBranchPeopleLabels();
  const { isPending } = useSession();
  const sessionReady = hasMounted && !isPending;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    async function loadStats() {
      const [data, error] = await getParentEnrollmentStatsAction();

      if (error || !data) {
        setStats(emptyStats);
        return;
      }

      setStats(data);
    }

    if (sessionReady) void loadStats();
  }, [sessionReady]);

  const yearRatio = stats.totalParents
    ? Math.round((stats.parentsCurrentYear / stats.totalParents) * 100)
    : 0;

  const yearLabel = stats.currentYearName ?? t("parents.currentYear");

  const statCards = [
    {
      label: t("parents.total"),
      value: stats.totalParents,
      description: t("parents.tutors"),
      icon: IconUsersGroup,
    },
    {
      label: t("parents.tutorsYear", { year: yearLabel }),
      value: stats.parentsCurrentYear,
      description: t("parents.withStudent", { student: peopleLabels.studentLower }),
      icon: IconUsers,
    },
    {
      label: t("parents.enrollmentsYear", { year: yearLabel }),
      value: stats.enrollmentsCurrentYear,
      description: t("parents.studentsEnrolled", {
        students: peopleLabels.studentPluralLower,
      }),
      icon: IconSchool,
    },
  ];

  return (
    <BranchPageShell
      title={t("parents.title")}
      description={t("parents.description")}
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              {t("parents.badge")}
            </Badge>
          }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item) => (
            <BranchStatCard
              key={item.label}
              label={item.label}
              value={item.value}
              description={item.description}
              icon={item.icon}
            />
          ))}

          <BranchStatCard
            label={t("parents.coverage", { year: yearLabel })}
            value={`${stats.parentsCurrentYear} / ${stats.totalParents}`}
            description={t("parents.coverageHint")}
            icon={IconCalendarStats}
            footer={
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-600 transition-all"
                  style={{ width: `${yearRatio}%` }}
                />
              </div>
            }
          />
        </div>

        {stats.byYear.length > 0 ? (
          <Card
            variant="elevated"
            className="rounded-2xl border p-4 shadow-sm sm:p-5"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Répartition par année scolaire
              </h2>
              <p className="text-xs text-muted-foreground">
                Selon les inscriptions {peopleLabels.studentPluralLower}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {stats.byYear.map((year) => (
                <div
                  key={year.yearId}
                  className="flex items-center justify-between rounded-xl border border-blue-50 bg-muted/80 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {year.nameYear}
                      {year.isCurrentYear ? (
                        <span className="ml-2 text-[10px] font-semibold uppercase text-emerald-700">
                          Courante
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {year.enrollmentsCount} inscription
                      {year.enrollmentsCount > 1 ? "s" : ""}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    {year.parentsCount}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <Card
          variant="elevated"
          className="overflow-hidden rounded-2xl border border-border"
        >
          <UserList refreshKey={0} />
        </Card>
    </BranchPageShell>
  );
}
