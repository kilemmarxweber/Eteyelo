"use client";

import { BranchPageShell } from "@/components/layout/branch-page-shell";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { NotFoundView } from "@/components/not-found-view";
import {
  IconChalkboardTeacher,
  IconUserCheck,
  IconUserPlus,
  IconUserQuestion,
  IconUsers,
} from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import { Badge } from "@/components/ui/badge";
import { BranchStatCard } from "@/components/ui/branch-stat-card";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSession } from "@/lib/auth-client";
import {
  canAccessPedagogyArea,
  canManageOrganization,
  isOrganizationOwnerSession,
} from "@/lib/auth/session-roles";

import UserList from "./components/TeachersTable";
import { TeacherUpForm } from "./components/teacher-form";
import { getTeacherDashboardStatsAction } from "./teacher.action";
import { ImportStaffDialog } from "../components/import-staff-dialog";
import { getStaffPageContextAction } from "../staff-import.action";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";
import { IconUpload } from "@tabler/icons-react";
import { cycleLabel, type SchoolCycle } from "@/lib/cycle";

export type TeacherAssignmentFilter =
  | "all"
  | "active"
  | "assigned"
  | "unassigned";

export type TeacherCycleFilter = "all" | SchoolCycle;

type TeacherDashboardStats = {
  totalActive: number;
  assigned: number;
  unassigned: number;
  totalAssignments: number;
  coveredClasses: number;
  coveredCourses: number;
  averageAssignments: number;
  cycles: SchoolCycle[];
};

export default function Teachers() {
  const t = useTranslations("users");
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [supportsStaffImport, setSupportsStaffImport] = useState(false);
  const peopleLabels = useBranchPeopleLabels();
  const [stats, setStats] = useState<TeacherDashboardStats | null>(null);
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [cycleFilter, setCycleFilter] = useState<TeacherCycleFilter>("all");
  const [assignmentFilter, setAssignmentFilter] =
    useState<TeacherAssignmentFilter>("all");
  const { data: session, isPending } = useSession();
  const [hasMounted, setHasMounted] = useState(false);
  const sessionReady = hasMounted && !isPending;
  const canManage = sessionReady && canManageOrganization(session);
  const canPurgePermanently =
    sessionReady && isOrganizationOwnerSession(session);

  const handleUserAction = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const applyCycleFilter = (cycle: TeacherCycleFilter) => {
    setCycleFilter(cycle);
    setAssignmentFilter("all");
    setStats(null);
  };

  const cycleDescription =
    cycleFilter === "all" ? null : cycleLabel(cycleFilter);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    async function loadStats() {
      const [data, error] = await getTeacherDashboardStatsAction(
        cycleFilter === "all" ? {} : { cycle: cycleFilter },
      );
      if (!error && data) {
        setStats(data);
        setCycles(data.cycles);
      }
    }
    if (sessionReady && session) void loadStats();
  }, [cycleFilter, refreshKey, session, sessionReady]);

  useEffect(() => {
    void getStaffPageContextAction().then((context) => {
      setSupportsStaffImport(Boolean(context.supportsStaffImport));
    });
  }, [refreshKey]);

  if (
    sessionReady &&
    (!session || !canAccessPedagogyArea(session))
  ) {
    return <NotFoundView />;
  }

  return (
    <BranchPageShell
      title={t("teachers.title", { teachers: peopleLabels.teacherPlural })}
      description={t("teachers.description", {
        teachers: peopleLabels.teacherPluralLower,
      })}
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              {peopleLabels.teacherPlural}
            </Badge>
          }
          actions={
            canManage ? (
              <div className="flex flex-wrap items-center gap-2">
                {supportsStaffImport ? (
                  <Button
                    size="sm"
                    variant="outline"
                    leftSection={<IconUpload size={16} />}
                    onClick={() => setImportOpen(true)}
                  >
                    {t("teachers.importOne", { teacher: peopleLabels.teacherLower })}
                  </Button>
                ) : null}
                <Sheet open={open} onOpenChange={setOpen}>
                  <SheetTrigger asChild>
                    <Button
                      size="sm"
                      variant="default"
                      leftSection={<IconUserPlus size={16} />}
                    >
                      {t("teachers.addOne", { teacher: peopleLabels.teacher })}
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="right"
                    className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
                  >
                    <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
                      <SheetTitle>
                        {t("teachers.createTitle", { teacher: peopleLabels.teacher })}
                      </SheetTitle>
                      <SheetDescription>
                        {t("teachers.createDesc", {
                          teacher: peopleLabels.teacherLower,
                        })}
                      </SheetDescription>
                    </SheetHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                      <TeacherUpForm
                        mode="create"
                        layout="dialog"
                        onTeacherCreated={() => {
                          handleUserAction();
                          setOpen(false);
                        }}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            ) : null
          }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            {
              label: `${peopleLabels.teacherPlural} actifs`,
              value: stats?.totalActive,
              icon: IconUsers,
              filter: "active" as const,
              description: cycleDescription
                ? `Comptes actifs · ${cycleDescription}`
                : "Comptes actifs",
            },
            {
              label: "Affectes",
              value: stats?.assigned,
              icon: IconUserCheck,
              filter: "assigned" as const,
              description: cycleDescription
                ? `Avec cours · ${cycleDescription}`
                : "Avec classe et cours",
            },
            {
              label: "Non affectes",
              value: stats?.unassigned,
              icon: IconUserQuestion,
              filter: "unassigned" as const,
              description: cycleDescription
                ? `Sans cours · ${cycleDescription}`
                : "A traiter",
            },
            {
              label: "Affectations",
              value: stats?.totalAssignments,
              icon: IconChalkboardTeacher,
              filter: "assigned" as const,
              description: cycleDescription
                ? `Cours-classe · ${cycleDescription}`
                : "Cours-classe actifs",
            },
            {
              label: "Charge moyenne",
              value: stats?.averageAssignments,
              icon: IconChalkboardTeacher,
              filter: "assigned" as const,
              description: `Par ${peopleLabels.teacherLower} affecte`,
            },
          ].map((item) => {
            const isActive = assignmentFilter === item.filter;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() =>
                  setAssignmentFilter(isActive ? "all" : item.filter)
                }
                className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-pressed={isActive}
              >
                <BranchStatCard
                  label={item.label}
                  value={item.value ?? "—"}
                  description={item.description}
                  icon={item.icon}
                  className={
                    isActive
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                      : undefined
                  }
                />
              </button>
            );
          })}
        </div>
        <Card
          variant="elevated"
          className="mt-0 border p-1 md:p-4 rounded-md shadow-sm"
        >
          <ImportStaffDialog
            kind="teacher"
            open={importOpen}
            onOpenChange={setImportOpen}
            onSuccess={handleUserAction}
            peopleLabels={peopleLabels}
          />
          <UserList
            key={refreshKey}
            refreshKey={refreshKey}
            onRefresh={handleUserAction}
            canManageTeachers={canManage}
            canPurgePermanently={canPurgePermanently}
            assignmentFilter={assignmentFilter}
            cycleFilter={cycleFilter}
            cycles={cycles}
            onCycleFilterChange={applyCycleFilter}
            supportsStaffImport={supportsStaffImport}
            onOpenImport={() => setImportOpen(true)}
          />
        </Card>
    </BranchPageShell>
  );
}
