"use client";

import { useEffect, useState } from "react";
import { NotFoundView } from "@/components/not-found-view";
import {
  IconGenderBigender,
  IconUserCheck,
  IconUserOff,
  IconUserPlus,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";

import { Layout, LayoutBody } from "@/components/custom/layout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/lib/auth-client";
import { canManageOrganization } from "@/lib/auth/session-roles";

import Loading from "../loading";
import { getStudentsAction } from "./student.action";
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

export default function Students() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState<StudentStats>(emptyStats);

  const { data: session, isPending } = useSession();
  const canManage = canManageOrganization(session);

  const handleUserAction = () => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    async function loadStats() {
      const [data, error] = await getStudentsAction();

      if (error || !Array.isArray(data)) {
        setStats(emptyStats);
        return;
      }

      const students = data;

      const { start, end } = getCurrentQuarterRange();

      // Actif = inscrit à une classe de l'année en cours ; inactif = non inscrit
      const isEnrolledCurrentYear = (student: (typeof students)[number]) =>
        Boolean(student.classCode);

      setStats({
        total: students.length,

        actifs: students.filter(isEnrolledCurrentYear).length,

        inactifs: students.filter((student) => !isEnrolledCurrentYear(student))
          .length,

        nouveauxTrimestre: students.filter((student) => {
          const createdAt = new Date(student.createdAt);
          return createdAt >= start && createdAt < end;
        }).length,

        masculin: students.filter((student) => student.sexe === "M").length,

        feminin: students.filter((student) => student.sexe === "F").length,
      });
    }

    loadStats();
  }, [refreshKey]);
  if (isPending) return <Loading />;

  if (!session) {
    return <NotFoundView />;
  }

  const statCards = [
    {
      label: "Total élèves",
      value: stats.total,
      description: "élèves",
      icon: IconUsersGroup,
    },
    {
      label: "Actifs",
      value: stats.actifs,
      description: "inscrits année en cours",
      icon: IconUserCheck,
    },
    {
      label: "Inactifs",
      value: stats.inactifs,
      description: "non inscrits année en cours",
      icon: IconUserOff,
    },
    {
      label: "Nouvels élèves",
      value: stats.nouveauxTrimestre,
      description: "élèves",
      icon: IconUserPlus,
    },
  ];

  const totalGenre = stats.masculin + stats.feminin;
  const masculinPercent = totalGenre
    ? Math.round((stats.masculin / totalGenre) * 100)
    : 0;
  const femininPercent = 100 - masculinPercent;

  return (
    <Layout>
      <LayoutBody className="space-y-6">
        <PageHeader
          title="Gestion des élèves"
          description="Dossiers élèves et suivi académique en temps réel."
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              Élèves
            </Badge>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {statCards.map((item) => {
            const Icon = item.icon;

            return (
              <Card
                key={item.label}
                variant="elevated"
                className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-950/70">
                      {item.label}
                    </p>
                    <h3 className="mt-3 text-3xl font-black text-blue-950">
                      {item.value}
                    </h3>
                    <p className="mt-1 text-xs text-blue-950/50">
                      {item.description}
                    </p>
                  </div>

                  <div className="rounded-full bg-blue-50 p-2 text-blue-700">
                    <Icon size={20} />
                  </div>
                </div>
              </Card>
            );
          })}

          <Card
            variant="elevated"
            className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-950/70">
                  Sexe | genre
                </p>
                <h3 className="mt-3 text-3xl font-black text-blue-950">
                  {stats.masculin}M / {stats.feminin}F
                </h3>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-blue-100">
                  <div className="flex h-full">
                    <div
                      className="bg-blue-700"
                      style={{ width: `${masculinPercent}%` }}
                    />
                    <div
                      className="bg-blue-950"
                      style={{ width: `${femininPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-full bg-blue-50 p-2 text-blue-700">
                <IconGenderBigender size={20} />
              </div>
            </div>
          </Card>
        </div>

        <Card
          variant="elevated"
          className="overflow-hidden rounded-2xl border border-blue-100"
        >
          <UserList
            key={refreshKey}
            refreshKey={refreshKey}
            onRefresh={handleUserAction}
            canManageStudents={canManage}
          />
        </Card>
      </LayoutBody>
    </Layout>
  );
}
