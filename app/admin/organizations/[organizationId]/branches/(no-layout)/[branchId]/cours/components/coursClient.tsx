"use client";

import { BranchPageShell } from "@/components/layout/branch-page-shell";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  IconBook,
  IconBookOff,
  IconBooks,
  IconDownload,
  IconPlus,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/custom/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BranchStatCard } from "@/components/ui/branch-stat-card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSession } from "@/lib/auth-client";
import { useTemporaryGrantActions } from "@/hooks/use-temporary-grant-actions";
import { useRefresh } from "@/src/hooks/RefreshContext";
import {
  getCoursAction,
  importSecondaryCatalogCoursesAction,
} from "../cours.action";
import { CoursUpForm } from "./cours-form";
import CoursList from "./coursTable";
import { ImportCourseDialog } from "./import-course-dialog";

export default function Cours({
  isPrimary = false,
  supportsCourseImport = false,
}: {
  isPrimary?: boolean;
  supportsCourseImport?: boolean;
}) {
  const t = useTranslations("teaching.courses");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [importCourseOpen, setImportCourseOpen] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [importing, startImport] = useTransition();
  const { refreshKey, refresh } = useRefresh();
  const { isPending } = useSession();
  const [hasMounted, setHasMounted] = useState(false);
  const sessionReady = hasMounted && !isPending;
  const { canCreate: canCreateFromGrant } = useTemporaryGrantActions("courses");
  const canCreate = sessionReady && canCreateFromGrant;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    void (async () => {
      const [items] = await getCoursAction({ includeInactive: true });
      if (!items) return;
      const active = items.filter((item) => item.statusCours !== false).length;
      setStats({
        total: items.length,
        active,
        inactive: items.length - active,
      });
    })();
  }, [refreshKey]);

  function handleSaved() {
    refresh();
    setOpen(false);
  }

  function handleImportCatalog() {
    startImport(async () => {
      try {
        const result = await importSecondaryCatalogCoursesAction();
        if (!result.success) {
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
        refresh();
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : t("importCatalogFail");
        toast.error(message);
      }
    });
  }

  const headerActions = canCreate ? (
    <div className="flex flex-wrap gap-2">
      {!isPrimary && !supportsCourseImport ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          loading={importing}
          disabled={stats.total > 0}
          title={
            stats.total > 0
              ? t("importCatalogDisabled")
              : undefined
          }
          onClick={handleImportCatalog}
        >
          <IconDownload size={16} className="mr-2" />
          {t("importCatalog")}
        </Button>
      ) : null}
      {supportsCourseImport ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setImportCourseOpen(true)}
        >
          <IconDownload size={16} className="mr-2" />
          {t("importCourse")}
        </Button>
      ) : null}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size="sm" leftSection={<IconPlus size={16} />}>
            {t("addCourse")}
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
        >
          <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
            <SheetTitle>{t("createTitle")}</SheetTitle>
            <SheetDescription>
              {isPrimary
                ? t("createDescPrimary")
                : t("createDescSecondary")}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <CoursUpForm
              mode="create"
              layout="dialog"
              isPrimary={isPrimary}
              onCreated={handleSaved}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  ) : null;

  return (
    <BranchPageShell
      title={t("title")}
          description={
            isPrimary
              ? t("descPrimary")
              : supportsCourseImport
                ? t("descImportOrg")
                : t("descImportCatalog")
          }
          badge={
            <Badge variant="outline-primary" icon={<IconBooks size={14} />}>
              {t("badge")}
            </Badge>
          }
          actions={headerActions}
    >
      <div className="grid gap-4 sm:grid-cols-3">
          <BranchStatCard
            label={t("total")}
            value={stats.total}
            description={t("totalHint")}
            icon={IconBooks}
          />
          <BranchStatCard
            label={t("active")}
            value={stats.active}
            description={t("activeHint")}
            icon={IconBook}
          />
          <BranchStatCard
            label={t("inactive")}
            value={stats.inactive}
            description={t("inactiveHint")}
            icon={IconBookOff}
          />
        </div>

        <Card
          variant="elevated"
          className="mt-0 rounded-md border p-1 shadow-sm md:p-4"
        >
          <CoursList refreshKey={refreshKey} isPrimary={isPrimary} />
        </Card>

        {supportsCourseImport ? (
          <ImportCourseDialog
            open={importCourseOpen}
            onOpenChange={setImportCourseOpen}
            onSuccess={refresh}
          />
        ) : null}
    </BranchPageShell>
  );
}
