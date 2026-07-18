"use client";

import { useEffect, useState, useTransition } from "react";
import {
  IconBook,
  IconBookOff,
  IconBooks,
  IconDownload,
  IconPlus,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { Button } from "@/components/custom/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/lib/auth-client";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { getCoursAction, importSecondaryCatalogCoursesAction } from "../cours.action";
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
      const active = items.filter(item => item.statusCours !== false).length;
      setStats({ total: items.length, active, inactive: items.length - active });
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
          error instanceof Error ? error.message : "Échec de l'import du catalogue";
        toast.error(message);
      }
    });
  }

  const headerActions = canCreate ? (
    <div className="flex flex-wrap gap-2">
      {!isPrimary && !supportsCourseImport ? (
        <Button
          type="button"
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
          variant="outline"
          onClick={() => setImportCourseOpen(true)}
        >
          <IconDownload size={16} className="mr-2" />
          Importer un cours
        </Button>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button leftSection={<IconPlus size={16} />}>Ajouter un cours</Button>
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
          <CoursUpForm mode="create" isPrimary={isPrimary} onCreated={handleSaved} />
        </DialogContent>
      </Dialog>
    </div>
  ) : null;

  return <Layout><LayoutBody className="space-y-5">
    <PageHeader title="Gestion des cours" description={isPrimary ? "Créez et organisez les matières enseignées dans cet établissement." : supportsCourseImport ? "Créez les matières ou importez des cours depuis une autre branche de l'organisation." : "Créez les matières ou importez le catalogue RDC (socle commun + spécialités par option)."} badge={<Badge variant="outline-primary" icon={<IconBooks size={14} />}>Cours</Badge>} actions={headerActions} />
    <div className="grid gap-3 sm:grid-cols-3"><StatCard label="Total des cours" value={stats.total} icon={<IconBooks className="size-5" />} /><StatCard label="Cours actifs" value={stats.active} icon={<IconBook className="size-5 text-emerald-600" />} /><StatCard label="Cours inactifs" value={stats.inactive} icon={<IconBookOff className="size-5 text-slate-500" />} /></div>
    <Card variant="elevated" className="overflow-hidden rounded-md border p-1 shadow-sm md:p-3"><CoursList refreshKey={refreshKey} isPrimary={isPrimary} /></Card>
    {supportsCourseImport ? (
      <ImportCourseDialog
        open={importCourseOpen}
        onOpenChange={setImportCourseOpen}
        onSuccess={refresh}
      />
    ) : null}
  </LayoutBody></Layout>;
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <Card className="flex items-center justify-between p-4"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div><div className="rounded-lg bg-muted p-2">{icon}</div></Card>;
}
