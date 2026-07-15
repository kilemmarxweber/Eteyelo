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
          title="Gestion des Enseignants"
          description="Gerer les informations des enseignants et leurs contrats dans l'etablissement"
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              Enseignants
            </Badge>
          }
          actions={
            canManage ? (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="default"
                    leftSection={<IconUserPlus size={16} />}
                  >
                    Ajouter un Enseignant
                  </Button>
                </DialogTrigger>
                <DialogContent size="lg">
                  <DialogHeader>
                    <DialogTitle>Creer un Enseignant</DialogTitle>
                    <DialogDescription>
                      Remplir les informations de l'enseignant.
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
            ) : null
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            {
              label: "Enseignants actifs",
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
              description: "Par enseignant affecte",
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
                  variant="elevated"
                  className={`h-full rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
                    isActive
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                      : "border-blue-100 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-blue-950/65">
                        {item.label}
                      </p>
                      <p className="mt-2 text-2xl font-black text-blue-950">
                        {item.value ?? "—"}
                      </p>
                      <p className="mt-1 text-[11px] text-blue-950/50">
                        {item.description}
                      </p>
                    </div>
                    <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
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
          <UserList
            key={refreshKey}
            refreshKey={refreshKey}
            onRefresh={handleUserAction}
            canManageTeachers={canManage}
            assignmentFilter={assignmentFilter}
          />
        </Card>
      </LayoutBody>
    </Layout>
  );
}
