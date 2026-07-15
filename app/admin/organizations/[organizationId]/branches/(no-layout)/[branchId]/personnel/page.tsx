"use client";

import { useEffect, useState } from "react";
import {
  IconUserCheck,
  IconUserOff,
  IconUserPlus,
  IconUsers,
  IconUsersGroup,
  IconCalendarCheck,
} from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { NotFoundView } from "@/components/not-found-view";
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
import { PersonnelUpForm } from "./components/personnel-form";
import UserList from "./components/PersonnelsTable";
import {
  getPersonnelPresenceStatsAction,
  getPersonnelsAction,
} from "./personnel.action";

type PersonnelStats = {
  total: number;
  actifs: number;
  inactifs: number;
  present: number;
  totalExpected: number;
};

const emptyStats: PersonnelStats = {
  total: 0,
  actifs: 0,
  inactifs: 0,
  present: 0,
  totalExpected: 0,
};

export default function Personnels() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<PersonnelStats>(emptyStats);

  const { data: session, isPending } = useSession();
  const canManage = canManageOrganization(session);

  const handleUserAction = () => {
    setRefreshKey((prev) => prev + 1);
    setOpen(false);
  };

  useEffect(() => {
    async function loadStats() {
      const [[data, error], [presence, presenceError]] = await Promise.all([
        getPersonnelsAction(),
        getPersonnelPresenceStatsAction(),
      ]);

      if (error || !Array.isArray(data)) {
        setStats(emptyStats);
        return;
      }

      setStats({
        total: data.length,
        actifs: data.filter((item) => item.statusPersonnal === true).length,
        inactifs: data.filter((item) => item.statusPersonnal === false).length,
        present: presenceError || !presence ? 0 : presence.present,
        totalExpected:
          presenceError || !presence ? data.length : presence.totalExpected,
      });
    }

    void loadStats();
  }, [refreshKey]);

  if (isPending) return <Loading />;
  if (!session) return <NotFoundView />;

  const presencePercent = stats.totalExpected
    ? Math.round((stats.present / stats.totalExpected) * 100)
    : 0;

  const statCards = [
    {
      label: "Total personnels",
      value: stats.total,
      description: "membres",
      icon: IconUsersGroup,
    },
    {
      label: "Actifs",
      value: stats.actifs,
      description: "membres",
      icon: IconUserCheck,
    },
    {
      label: "Inactifs",
      value: stats.inactifs,
      description: "membres",
      icon: IconUserOff,
    },
  ];

  return (
    <Layout>
      <LayoutBody className="space-y-6">
        <PageHeader
          title="Gestion des personnels"
          description="Gérer les informations des personnels administratifs et leurs contrats dans l'établissement."
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              Personnels
            </Badge>
          }
          actions={
            canManage ? (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="default"
                    leftSection={<IconUserPlus size={16} />}
                  >
                    Ajouter un personnel
                  </Button>
                </DialogTrigger>

                <DialogContent size="xl">
                  <DialogHeader>
                    <DialogTitle>Créer un personnel administratif</DialogTitle>
                    <DialogDescription>
                      Ajoutez un nouveau membre du personnel.
                    </DialogDescription>
                  </DialogHeader>

                  <PersonnelUpForm
                    mode="create"
                    onCreated={handleUserAction}
                    onPersonnelCreated={handleUserAction}
                  />
                </DialogContent>
              </Dialog>
            ) : null
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  Présents aujourd&apos;hui
                </p>
                <h3 className="mt-3 text-3xl font-black text-blue-950">
                  {stats.present} / {stats.totalExpected}
                </h3>
                <p className="mt-1 text-xs text-blue-950/50">
                  présents / total prévu
                </p>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-blue-100">
                  <div
                    className="h-full bg-emerald-600 transition-all"
                    style={{ width: `${presencePercent}%` }}
                  />
                </div>
              </div>

              <div className="rounded-full bg-blue-50 p-2 text-blue-700">
                <IconCalendarCheck size={20} />
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
            canManagePersonnel={canManage}
          />
        </Card>
      </LayoutBody>
    </Layout>
  );
}
