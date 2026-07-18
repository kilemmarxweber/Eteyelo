"use client";

import { useEffect, useState } from "react";
import {
  IconCalendarStats,
  IconSchool,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";

import { Layout, LayoutBody } from "@/components/custom/layout";
import { NotFoundView } from "@/components/not-found-view";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/lib/auth-client";

import Loading from "../loading";
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
  const [stats, setStats] = useState<ParentStats>(emptyStats);
  const peopleLabels = useBranchPeopleLabels();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    async function loadStats() {
      const [data, error] = await getParentEnrollmentStatsAction();

      if (error || !data) {
        setStats(emptyStats);
        return;
      }

      setStats(data);
    }

    void loadStats();
  }, []);

  if (isPending) return <Loading />;
  if (!session) return <NotFoundView />;

  const yearRatio = stats.totalParents
    ? Math.round((stats.parentsCurrentYear / stats.totalParents) * 100)
    : 0;

  const yearLabel = stats.currentYearName ?? "Année en cours";

  const statCards = [
    {
      label: "Total général",
      value: stats.totalParents,
      description: "tuteurs",
      icon: IconUsersGroup,
    },
    {
      label: `Tuteurs ${yearLabel}`,
      value: stats.parentsCurrentYear,
      description: `avec ${peopleLabels.studentLower} inscrit`,
      icon: IconUsers,
    },
    {
      label: `Inscriptions ${yearLabel}`,
      value: stats.enrollmentsCurrentYear,
      description: `${peopleLabels.studentPluralLower} inscrits`,
      icon: IconSchool,
    },
  ];

  return (
    <Layout>
      <LayoutBody className="space-y-6">
        <PageHeader
          title="Gestion des Tuteurs"
          description="Gérer les informations des tuteurs et le suivi des inscriptions de leurs enfants."
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              Tuteurs
            </Badge>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.label} variant="stat">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      {item.label}
                    </p>
                    <h3 className="mt-3 text-3xl font-black text-foreground">
                      {item.value}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>

                  <div className="rounded-full bg-muted p-2 text-primary">
                    <Icon size={20} />
                  </div>
                </div>
              </Card>
            );
          })}

          <Card variant="stat">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  Couverture {yearLabel}
                </p>
                <h3 className="mt-3 text-3xl font-black text-foreground">
                  {stats.parentsCurrentYear} / {stats.totalParents}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  tuteurs avec inscription / total général
                </p>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-emerald-600 transition-all"
                    style={{ width: `${yearRatio}%` }}
                  />
                </div>
              </div>

              <div className="rounded-full bg-muted p-2 text-primary">
                <IconCalendarStats size={20} />
              </div>
            </div>
          </Card>
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
      </LayoutBody>
    </Layout>
  );
}
