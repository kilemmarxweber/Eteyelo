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
import { canManageOrganization } from "@/lib/auth/session-roles";
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
  const t = useTranslations("teaching");
  const [open, setOpen] = useState(false);
  const [importCourseOpen, setImportCourseOpen] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [importing, startImport] = useTransition();
  const { refreshKey, refresh } = useRefresh();
  const { data: session, isPending } = useSession();
  const [hasMounted, setHasMounted] = useState(false);
  const sessionReady = hasMounted && !isPending;
  const canCreate = sessionReady && canManageOrganization(session);

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
            : "Échec de l'import du catalogue";
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
              ? "Le catalogue ne peut plus être importé : des cours existent déjà."
              : undefined
          }
          onClick={handleImportCatalog}
        >
          <IconDownload size={16} className="mr-2" />
          Importer catalogue
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
          Importer un cours
        </Button>
      ) : null}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size="sm" leftSection={<IconPlus size={16} />}>
            Ajouter un cours
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
        >
          <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
            <SheetTitle>Créer un cours</SheetTitle>
            <SheetDescription>
              {isPrimary
                ? "Renseignez le nom, la description et optionnellement le domaine du bulletin."
                : "Renseignez le nom et la description. Le code unique sera généré automatiquement."}
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
      title={t("courses.title")}
          description={
            isPrimary
              ? t("courses.descPrimary")
              : supportsCourseImport
                ? t("courses.descImportOrg")
                : t("courses.descImportCatalog")
          }
          badge={
            <Badge variant="outline-primary" icon={<IconBooks size={14} />}>
              {t("courses.badge")}
            </Badge>
          }
          actions={headerActions}
    >
      <div className="grid gap-4 sm:grid-cols-3">
          <BranchStatCard
            label={t("courses.total")}
            value={stats.total}
            description={t("courses.totalHint")}
            icon={IconBooks}
          />
          <BranchStatCard
            label={t("courses.active")}
            value={stats.active}
            description={t("courses.activeHint")}
            icon={IconBook}
          />
          <BranchStatCard
            label={t("courses.inactive")}
            value={stats.inactive}
            description="Masqués des listes actives"
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
