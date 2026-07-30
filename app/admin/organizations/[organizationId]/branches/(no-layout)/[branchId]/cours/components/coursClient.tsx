"use client";

import { BranchPageShell } from "@/components/layout/branch-page-shell";

import { useEffect, useState, useTransition } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [open, setOpen] = useState(false);
  const [importCourseOpen, setImportCourseOpen] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [importing, startImport] = useTransition();
  const { refreshKey, refresh } = useRefresh();
  const { data: session } = useSession();
  const canCreate = canManageOrganization(session);

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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" leftSection={<IconPlus size={16} />}>
            Ajouter un cours
          </Button>
        </DialogTrigger>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Créer un cours</DialogTitle>
            <DialogDescription>
              {isPrimary
                ? "Renseignez le nom, la description et optionnellement le domaine du bulletin."
                : "Renseignez le nom et la description. Le code unique sera généré automatiquement."}
            </DialogDescription>
          </DialogHeader>
          <CoursUpForm
            mode="create"
            isPrimary={isPrimary}
            onCreated={handleSaved}
          />
        </DialogContent>
      </Dialog>
    </div>
  ) : null;

  return (
    <BranchPageShell
      title="Gestion des cours"
          description={
            isPrimary
              ? "Créez et organisez les matières enseignées dans cet établissement."
              : supportsCourseImport
                ? "Créez les matières ou importez des cours depuis une autre branche de l'organisation."
                : "Créez les matières ou importez le catalogue RDC (socle commun + spécialités par option)."
          }
          badge={
            <Badge variant="outline-primary" icon={<IconBooks size={14} />}>
              Cours
            </Badge>
          }
          actions={headerActions}
    >
      <div className="grid gap-4 sm:grid-cols-3">
          <BranchStatCard
            label="Total des cours"
            value={stats.total}
            description="Matières enregistrées"
            icon={IconBooks}
          />
          <BranchStatCard
            label="Cours actifs"
            value={stats.active}
            description="Disponibles pour affectation"
            icon={IconBook}
          />
          <BranchStatCard
            label="Cours inactifs"
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
