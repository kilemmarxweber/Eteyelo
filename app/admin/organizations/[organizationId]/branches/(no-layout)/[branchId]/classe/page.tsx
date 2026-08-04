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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSession } from "@/lib/auth-client";
import { canAccessBranchArea } from "@/lib/auth/branch-area-access";
import {
  getClassDisplayLabel,
  getClassDisplayLabelPlural,
  isUniversiteBranch,
} from "@/lib/branch-capabilities";

import Loading from "../loading";
import { getStudentPageContextAction } from "../brevets/brevet.action";
import Classes from "./components/ClassesClient";
import { ClasseUpForm } from "./components/classe-form";
import { getClassesAction, importClassCatalogAction } from "./classe.action";

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
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Échec de l'import du catalogue",
        );
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
            size="sm"
            variant="outline"
            loading={importing}
            disabled={stats.total > 0}
            title={
              stats.total > 0
                ? "Le catalogue ne peut plus être importé : des classes existent déjà."
                : undefined
            }
            onClick={handleImportCatalog}
          >
            <IconDownload size={16} className="mr-2" />
            Importer catalogue
          </Button>
          <Button
            type="button"
            size="sm"
            variant="default"
            leftSection={<IconUserPlus size={16} />}
            onClick={() => setOpen(true)}
          >
            {`Créer une ${classLabel.toLowerCase()}`}
          </Button>
        </div>
      }
    >
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
        >
          <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
            <SheetTitle>{`Créer une ${classLabel.toLowerCase()}`}</SheetTitle>
            <SheetDescription>
              {`Niveau, section, option et vacation de la ${classLabel.toLowerCase()}.`}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            {open ? (
              <ClasseUpForm
                key="create-classe"
                mode="create"
                layout="sheet"
                onCreated={() => {
                  setRefreshKey((value) => value + 1);
                  setOpen(false);
                }}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

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
