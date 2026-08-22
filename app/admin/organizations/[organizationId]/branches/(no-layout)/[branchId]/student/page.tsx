"use client";

import { BranchPageShell } from "@/components/layout/branch-page-shell";

import { useCallback, useEffect, useState } from "react";
import { NotFoundView } from "@/components/not-found-view";
import {
  IconGenderBigender,
  IconUserCheck,
  IconUserOff,
  IconUserPlus,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { BranchStatCard } from "@/components/ui/branch-stat-card";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";
import { canAccessBranchArea } from "@/lib/auth/branch-area-access";
import {
  canManageOrganization,
  isOrganizationOwnerSession,
} from "@/lib/auth/session-roles";

import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";
import { pluralizeStudentLabelLower } from "@/lib/people-labels";
import type { IStudent } from "@/src/interfaces/Student";
import UserList from "./components/StudentsTable";

type StudentStats = {
  total: number;
  actifs: number;
  inactifs: number;
  nouveauxTrimestre: number;
  masculin: number;
  feminin: number;
};

const emptyStats: StudentStats = {
  total: 0,
  actifs: 0,
  inactifs: 0,
  nouveauxTrimestre: 0,
  masculin: 0,
  feminin: 0,
};

function getCurrentQuarterRange() {
  const now = new Date();
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;

  const start = new Date(now.getFullYear(), quarterStartMonth, 1);
  const end = new Date(now.getFullYear(), quarterStartMonth + 3, 1);

  return { start, end };
}

function computeStudentStats(students: IStudent[]): StudentStats {
  const { start, end } = getCurrentQuarterRange();
  const isEnrolled = (student: IStudent) => Boolean(student.classCode);
  const assignedStudents = students.filter(isEnrolled);

  return {
    total: students.length,
    actifs: assignedStudents.length,
    inactifs: students.filter((student) => !isEnrolled(student)).length,
    nouveauxTrimestre: students.filter((student) => {
      const createdAt = new Date(student.createdAt);
      return createdAt >= start && createdAt < end;
    }).length,
    masculin: students.filter((student) => student.sexe === "M").length,
    feminin: students.filter((student) => student.sexe === "F").length,
  };
}

export default function Students() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState<StudentStats>(emptyStats);
  const peopleLabels = useBranchPeopleLabels();

  const { data: session, isPending } = useSession();
  const [hasMounted, setHasMounted] = useState(false);
  const sessionReady = hasMounted && !isPending;
  const canManage = sessionReady && canManageOrganization(session);
  const canPurgePermanently =
    sessionReady && isOrganizationOwnerSession(session);

  const handleUserAction = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleVisibleStudentsChange = useCallback((students: IStudent[]) => {
    const next = computeStudentStats(students);
    setStats((prev) =>
      prev.total === next.total &&
      prev.actifs === next.actifs &&
      prev.inactifs === next.inactifs &&
      prev.nouveauxTrimestre === next.nouveauxTrimestre &&
      prev.masculin === next.masculin &&
      prev.feminin === next.feminin
        ? prev
        : next,
    );
  }, []);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (
    sessionReady &&
    (!session || !canAccessBranchArea("students", session))
  ) {
    return <NotFoundView />;
  }

  const studentWord = pluralizeStudentLabelLower(peopleLabels, stats.total);
  const nouveauxWord = pluralizeStudentLabelLower(
    peopleLabels,
    stats.nouveauxTrimestre,
  );

  const statCards = [
    {
      label: `Total ${studentWord}`,
      value: stats.total,
      description: "selon filtres / tri actifs",
      icon: IconUsersGroup,
    },
    {
      label: "Actifs",
      value: stats.actifs,
      description: "avec classe assignée",
      icon: IconUserCheck,
    },
    {
      label: "Inactifs",
      value: stats.inactifs,
      description: "sans inscription visible",
      icon: IconUserOff,
    },
    {
      label: `Nouveaux ${nouveauxWord}`,
      value: stats.nouveauxTrimestre,
      description: "ce trimestre (filtrés)",
      icon: IconUserPlus,
    },
  ];

  const totalGenre = stats.masculin + stats.feminin;
  const masculinPercent = totalGenre
    ? Math.round((stats.masculin / totalGenre) * 100)
    : 0;
  const femininPercent = totalGenre ? 100 - masculinPercent : 0;

  return (
    <BranchPageShell
      title={`Gestion des ${peopleLabels.studentPluralLower}`}
      description={`Dossiers ${peopleLabels.studentPluralLower} et suivi académique en temps réel.`}
      badge={
        <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
          {peopleLabels.studentPlural}
        </Badge>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
          label="Sexe / genre"
          value={
            <span>
              <span className="text-blue-700">{stats.masculin}M</span>
              <span className="mx-1.5 text-muted-foreground">/</span>
              <span className="text-sky-800">{stats.feminin}F</span>
            </span>
          }
          icon={IconGenderBigender}
          footer={
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                <span>{masculinPercent}% M</span>
                <span>{femininPercent}% F</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="flex h-full">
                  <div
                    className="bg-blue-700 transition-all"
                    style={{ width: `${masculinPercent}%` }}
                  />
                  <div
                    className="bg-sky-800 transition-all"
                    style={{ width: `${femininPercent}%` }}
                  />
                </div>
              </div>
            </div>
          }
        />
      </div>

      <Card
        variant="elevated"
        className="overflow-hidden rounded-2xl border border-border shadow-sm"
      >
        <div className="border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-foreground">
            Liste des {peopleLabels.studentPluralLower}
            <span className="ml-2 font-normal text-muted-foreground">
              ({stats.total})
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Totaux recalculés selon les filtres et le tri actifs.
          </p>
        </div>
        <UserList
          key={refreshKey}
          refreshKey={refreshKey}
          onRefresh={handleUserAction}
          canManageStudents={canManage}
          canPurgePermanently={canPurgePermanently}
          onVisibleStudentsChange={handleVisibleStudentsChange}
        />
      </Card>
    </BranchPageShell>
  );
}
