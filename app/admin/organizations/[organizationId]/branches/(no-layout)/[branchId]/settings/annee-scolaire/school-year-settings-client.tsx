"use client";

import { useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { toast } from "sonner";
import { IconCalendarEvent, IconPlus } from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { canPrepareNextAcademicYear } from "@/lib/academic-year";
import { useSchoolYearLabels } from "@/hooks/use-school-year-labels";

import { SchoolYearUpForm } from "../../schoolYear/components/SchoolYear-form";
import SchoolYearsList from "../../schoolYear/components/SchoolYearsTable";
import { prepareNextSchoolYearAction } from "../../schoolYear/schoolYear.action";

interface Props {
  branchId: string;
}

export default function SchoolYearSettingsClient({ branchId }: Props) {
  const [open, setOpen] = useState(false);
  const [isPreparing, startPreparing] = useTransition();
  const { refreshKey, refresh } = useRefresh();
  const { labelPlural, labelLower } = useSchoolYearLabels();
  const canPrepareNextYear = canPrepareNextAcademicYear();

  const handleCreated = () => {
    refresh();
    setOpen(false);
  };

  const handlePrepareNextYear = () => {
    startPreparing(async () => {
      const [schoolYear, err] = await prepareNextSchoolYearAction();

      if (err) {
        toast.error(err.message);
        return;
      }

      toast.success(
        schoolYear?.nameYear
          ? `Année ${schoolYear.nameYear} préparée`
          : "Prochaine année préparée",
      );
      refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{labelPlural}</h2>
            <Badge
              variant="outline-primary"
              icon={<IconCalendarEvent size={14} />}
            >
              Scolarité
            </Badge>
          </div>
          <p className="max-w-7xl text-sm text-muted-foreground">
            Gérez les {labelPlural.toLowerCase()} actives et préparez la
            suivante.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1 sm:items-end">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={isPreparing}
              disabled={!canPrepareNextYear}
              title={
                canPrepareNextYear
                  ? `Crée automatiquement la prochaine ${labelLower} (ex. 2026-2027)`
                  : "Disponible à partir du mois d'août"
              }
              onClick={handlePrepareNextYear}
            >
              Préparer la prochaine année
            </Button>
            <Button
              type="button"
              size="sm"
              variant="default"
              leftSection={<IconPlus size={16} />}
              onClick={() => setOpen(true)}
            >
              Ajouter une année
            </Button>
          </div>
          {!canPrepareNextYear ? (
            <p className="text-xs text-muted-foreground">
              Disponible à partir d&apos;août — crée la prochaine {labelLower}{" "}
              pour préparation.
            </p>
          ) : null}
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
        >
          <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
            <SheetTitle>Ajouter une {labelLower}</SheetTitle>
            <SheetDescription>
              Renseignez le nom et les dates de l&apos;{labelLower}, puis
              enregistrez.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <SchoolYearUpForm
              mode="create"
              layout="dialog"
              branchId={branchId}
              onCreated={handleCreated}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Card variant="elevated" padding="none" className="border p-1 md:p-4">
        <SchoolYearsList refreshKey={refreshKey} branchId={branchId} />
      </Card>
    </div>
  );
}
