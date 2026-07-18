"use client";

import { useEffect, useState } from "react";
import { NotFoundView } from "@/components/not-found-view";
import {
  IconChalkboardTeacher,
  IconUserCheck,
  IconUserPlus,
  IconUserQuestion,
  IconUsers,
} from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/lib/auth-client";
import { canManageOrganization } from "@/lib/auth/session-roles";

import Loading from "../loading";
import UserList from "./components/TeachersTable";
import { TeacherUpForm } from "./components/teacher-form";
import { getTeacherDashboardStatsAction } from "./teacher.action";
import { ImportStaffDialog } from "../components/import-staff-dialog";
import { getStaffPageContextAction } from "../staff-import.action";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";
import { IconUpload } from "@tabler/icons-react";

export type TeacherAssignmentFilter =
  | "all"
  | "active"
  | "assigned"
  | "unassigned";

type TeacherDashboardStats = {
  totalActive: number;
  assigned: number;
  unassigned: number;
  totalAssignments: number;
  coveredClasses: number;
  coveredCourses: number;
  averageAssignments: number;
};

export default function Teachers() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [supportsStaffImport, setSupportsStaffImport] = useState(false);
  const peopleLabels = useBranchPeopleLabels();
  const [stats, setStats] = useState<TeacherDashboardStats | null>(null);
  const [assignmentFilter, setAssignmentFilter] =
    useState<TeacherAssignmentFilter>("all");
  const { data: session, isPending } = useSession();
  const canManage = canManageOrganization(session);

  const handleUserAction = () => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    async function loadStats() {
      const [data, error] = await getTeacherDashboardStatsAction();
      if (!error && data) setStats(data);
    }
    if (session) void loadStats();
  }, [refreshKey, session]);

  useEffect(() => {
    void getStaffPageContextAction().then((context) => {
      setSupportsStaffImport(Boolean(context.supportsStaffImport));
    });
  }, [refreshKey]);

  if (isPending) {
    return <Loading />;
  }

  if (!session) {
    return <NotFoundView />;
  }

  return (
    <Layout>
      <LayoutBody className="space-y-6">
        <PageHeader
          title={`Gestion des ${peopleLabels.teacherPlural}`}
          description={`Gerer les informations des ${peopleLabels.teacherPluralLower} et leurs contrats dans l'etablissement`}
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
                    variant="outline"
                    leftSection={<IconUpload size={16} />}
                    onClick={() => setImportOpen(true)}
                  >
                    Importer un {peopleLabels.teacherLower}
                  </Button>
                ) : null}
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="default"
                      leftSection={<IconUserPlus size={16} />}
                    >
                      Ajouter un {peopleLabels.teacher}
                    </Button>
                  </DialogTrigger>
                  <DialogContent size="lg">
                    <DialogHeader>
                      <DialogTitle>Creer un {peopleLabels.teacher}</DialogTitle>
                      <DialogDescription>
                        Remplir les informations du {peopleLabels.teacherLower}.
                      </DialogDescription>
                    </DialogHeader>
                    <TeacherUpForm
                      mode="create"
                      onTeacherCreated={() => {
                        handleUserAction();
                        setOpen(false);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            ) : null
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            {
              label: `${peopleLabels.teacherPlural} actifs`,
              value: stats?.totalActive,
              icon: IconUsers,
              filter: "active" as const,
              description: "Comptes actifs",
            },
            {
              label: "Affectes",
              value: stats?.assigned,
              icon: IconUserCheck,
              filter: "assigned" as const,
              description: "Avec classe et cours",
            },
            {
              label: "Non affectes",
              value: stats?.unassigned,
              icon: IconUserQuestion,
              filter: "unassigned" as const,
              description: "A traiter",
            },
            {
              label: "Affectations",
              value: stats?.totalAssignments,
              icon: IconChalkboardTeacher,
              filter: "assigned" as const,
              description: "Cours-classe actifs",
            },
            {
              label: "Charge moyenne",
              value: stats?.averageAssignments,
              icon: IconChalkboardTeacher,
              filter: "assigned" as const,
              description: `Par ${peopleLabels.teacherLower} affecte`,
            },
          ].map((item) => {
            const Icon = item.icon;
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
                <Card
                  variant="stat"
                  padding="sm"
                  className={`h-full transition hover:-translate-y-0.5 hover:shadow-md ${
                    isActive
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="mt-2 text-2xl font-black text-foreground">
                        {item.value ?? "—"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted p-2 text-primary">
                      <Icon size={18} />
                    </div>
                  </div>
                </Card>
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
            assignmentFilter={assignmentFilter}
            supportsStaffImport={supportsStaffImport}
            onOpenImport={() => setImportOpen(true)}
          />
        </Card>
      </LayoutBody>
    </Layout>
  );
}
