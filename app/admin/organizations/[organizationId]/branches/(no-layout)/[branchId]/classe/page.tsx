"use client";

import { BranchPageShell } from "@/components/layout/branch-page-shell";

import { useEffect, useState, useTransition } from "react";
import { NotFoundView } from "@/components/not-found-view";
import {
  IconDownload,
  IconSchool,
  IconSchoolOff,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/custom/button";
import { Badge } from "@/components/ui/badge";
import { BranchStatCard } from "@/components/ui/branch-stat-card";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/lib/auth-client";
import { canAccessBranchArea } from "@/lib/auth/branch-area-access";

import Loading from "../loading";
import Classes from "./components/ClassesClient";
import { ClasseUpForm } from "./components/classe-form";
import { getClassesAction, importClassCatalogAction } from "./classe.action";
import { getStudentPageContextAction } from "../brevets/brevet.action";
import { isUniversiteBranch } from "@/lib/branch-capabilities";
import {
  getClassDisplayLabel,
  getClassDisplayLabelPlural,
} from "@/lib/branch-capabilities";

export default function Page() {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [importing, startImport] = useTransition();
  const [classLabel, setClassLabel] = useState("Classe");
  const [classLabelPlural, setClassLabelPlural] = useState("Classes");
  const { data: session, isPending } = useSession();

  useEffect(() => {
    void getStudentPageContextAction().then((context) => {
      if (isUniversiteBranch(context.typebranch)) {
        setClassLabel(getClassDisplayLabel(context.typebranch));
        setClassLabelPlural(getClassDisplayLabelPlural(context.typebranch));
      }
    });
  }, [refreshKey]);

  useEffect(() => {
    void (async () => {
      const [items] = await getClassesAction();
      if (!items) return;
      const active = items.filter((item) => item.statusClasse !== false).length;
      setStats({
        total: items.length,
        active,
        inactive: items.length - active,
      });
    })();
  }, [refreshKey]);

  if (isPending) {
    return <Loading />;
  }

  // Setup Classes : pédagogie admin uniquement (pas enseignant — unit-06).
  if (!session || !canAccessBranchArea("school_admin", session)) {
    return <NotFoundView />;
  }

  function handleImportCatalog() {
    startImport(async () => {
      try {
        const result = await importClassCatalogAction();
        toast.success(
          `${result.created} classe(s) créée(s), ${result.skipped} déjà présente(s)` +
            (result.sectionsCreated || result.optionsCreated
              ? ` · ${result.sectionsCreated} section(s), ${result.optionsCreated} option(s)`
              : ""),
        );
        setRefreshKey((value) => value + 1);
      } catch (error: any) {
        toast.error(error?.message || "Échec de l'import du catalogue");
      }
    });
  }

  return (
    <BranchPageShell
      title={`Gestion des ${classLabelPlural.toLowerCase()}`}
          description={`Créez les ${classLabelPlural.toLowerCase()} et organisez leur capacité, option et créneau.`}
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              {classLabelPlural}
            </Badge>
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                loading={importing}
                onClick={handleImportCatalog}
              >
                <IconDownload size={16} className="mr-2" />
                Importer catalogue
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={() => setOpen(true)}
              >
                <IconUserPlus size={16} className="mr-2" />
                {`Créer une ${classLabel.toLowerCase()}`}
              </Button>
            </div>
          }
    >
      <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            size="lg"
            className="gap-3"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <DialogHeader className="space-y-1">
              <DialogTitle>{`Créer une ${classLabel.toLowerCase()}`}</DialogTitle>
              <DialogDescription>
                {`Niveau, section, option et vacation de la ${classLabel.toLowerCase()}.`}
              </DialogDescription>
            </DialogHeader>

            {open ? (
              <ClasseUpForm
                key="create-classe"
                mode="create"
                onCreated={() => {
                  setRefreshKey((value) => value + 1);
                  setOpen(false);
                }}
              />
            ) : null}
          </DialogContent>
        </Dialog>

        <div className="grid gap-4 sm:grid-cols-3">
          <BranchStatCard
            label={`Total des ${classLabelPlural.toLowerCase()}`}
            value={stats.total}
            icon={IconUsers}
          />
          <BranchStatCard
            label={`${classLabelPlural} actifs`}
            value={stats.active}
            icon={IconSchool}
          />
          <BranchStatCard
            label={`${classLabelPlural} inactifs`}
            value={stats.inactive}
            icon={IconSchoolOff}
          />
        </div>

        <Card variant="elevated" padding="none">
          <Classes refreshKey={refreshKey} />
        </Card>
    </BranchPageShell>
  );
}
