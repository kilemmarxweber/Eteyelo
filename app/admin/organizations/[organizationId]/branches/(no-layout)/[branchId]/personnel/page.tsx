"use client";

import { BranchPageShell } from "@/components/layout/branch-page-shell";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  IconUserCheck,
  IconUserOff,
  IconUserPlus,
  IconUsers,
  IconUsersGroup,
  IconCalendarCheck,
} from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import { NotFoundView } from "@/components/not-found-view";
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
import { canAccessBranchArea } from "@/lib/auth/branch-area-access";
import {
  canManagePersonnelRecords,
  isOrganizationOwnerSession,
} from "@/lib/auth/session-roles";

import { PersonnelUpForm } from "./components/personnel-form";
import UserList from "./components/PersonnelsTable";
import {
  getPersonnelPresenceStatsAction,
  getPersonnelsAction,
} from "./personnel.action";
import { ImportStaffDialog } from "../components/import-staff-dialog";
import { getStaffPageContextAction } from "../staff-import.action";
import { IconUpload } from "@tabler/icons-react";

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
  const t = useTranslations("users");
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [supportsStaffImport, setSupportsStaffImport] = useState(false);
  const [stats, setStats] = useState<PersonnelStats>(emptyStats);

  const { data: session, isPending } = useSession();
  const [hasMounted, setHasMounted] = useState(false);
  const sessionReady = hasMounted && !isPending;
  const canManage = sessionReady && canManagePersonnelRecords(session);
  const canPurgePermanently =
    sessionReady && isOrganizationOwnerSession(session);

  const handleUserAction = () => {
    setRefreshKey((prev) => prev + 1);
    setOpen(false);
  };

  useEffect(() => {
    setHasMounted(true);
  }, []);

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

    if (sessionReady) void loadStats();
  }, [refreshKey, sessionReady]);

  useEffect(() => {
    void getStaffPageContextAction().then((context) => {
      setSupportsStaffImport(Boolean(context.supportsStaffImport));
    });
  }, [refreshKey]);

  if (
    sessionReady &&
    (!session || !canAccessBranchArea("hr_directory", session))
  ) {
    return <NotFoundView />;
  }

  const presencePercent = stats.totalExpected
    ? Math.round((stats.present / stats.totalExpected) * 100)
    : 0;

  const statCards = [
    {
      label: `${t("staff.badge")} total`,
      value: stats.total,
      description: t("staff.members"),
      icon: IconUsersGroup,
    },
    {
      label: t("staff.active"),
      value: stats.actifs,
      description: t("staff.members"),
      icon: IconUserCheck,
    },
    {
      label: t("staff.inactive"),
      value: stats.inactifs,
      description: t("staff.members"),
      icon: IconUserOff,
    },
  ];

  return (
    <BranchPageShell
      title={t("staff.title")}
      description={t("staff.description")}
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              {t("staff.badge")}
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
                    {t("staff.importOne")}
                  </Button>
                ) : null}
                <Sheet open={open} onOpenChange={setOpen}>
                  <SheetTrigger asChild>
                    <Button
                      size="sm"
                      variant="default"
                      leftSection={<IconUserPlus size={16} />}
                    >
                      {t("staff.addOne")}
                    </Button>
                  </SheetTrigger>

                  <SheetContent
                    side="right"
                    className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
                  >
                    <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
                      <SheetTitle>{t("staff.createTitle")}</SheetTitle>
                      <SheetDescription>
                        {t("staff.createDesc")}
                      </SheetDescription>
                    </SheetHeader>

                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                      <PersonnelUpForm
                        mode="create"
                        layout="dialog"
                        onCreated={handleUserAction}
                        onPersonnelCreated={handleUserAction}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            ) : null
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
            label="Présents aujourd'hui"
            value={`${stats.present} / ${stats.totalExpected}`}
            description={t("staff.presenceHint")}
            icon={IconCalendarCheck}
            footer={
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-600 transition-all"
                  style={{ width: `${presencePercent}%` }}
                />
              </div>
            }
          />
        </div>

        <Card
          variant="elevated"
          className="mt-0 rounded-md border p-1 shadow-sm md:p-4"
        >
          <ImportStaffDialog
            kind="personnel"
            open={importOpen}
            onOpenChange={setImportOpen}
            onSuccess={handleUserAction}
          />
          <UserList
            key={refreshKey}
            refreshKey={refreshKey}
            onRefresh={handleUserAction}
            canManagePersonnel={canManage}
            canPurgePermanently={canPurgePermanently}
            supportsStaffImport={supportsStaffImport}
            onOpenImport={() => setImportOpen(true)}
          />
        </Card>
    </BranchPageShell>
  );
}
