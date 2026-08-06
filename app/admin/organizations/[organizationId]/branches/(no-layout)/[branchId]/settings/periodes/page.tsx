"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { toast } from "sonner";
import {
  IconCalendarEvent,
  IconPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { PeriodUpForm } from "./period-form";
import {
  deletePeriodSettingsAction,
  ensurePeriodsFromTemplateAction,
  listPeriodsSettingsAction,
} from "./periodes.action";

type ListResult = Awaited<ReturnType<typeof listPeriodsSettingsAction>>;
type PeriodsSettingsData = NonNullable<ListResult[0]>;
type PeriodItem = PeriodsSettingsData["periods"][number];

function formatDisplayDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PeriodesSettingsPage() {
  const [data, setData] = useState<PeriodsSettingsData | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<PeriodItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [ensuring, setEnsuring] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadPeriods = useCallback(() => {
    startTransition(async () => {
      const [result, err] = await listPeriodsSettingsAction();
      if (err) {
        toast.error(err.message);
        return;
      }
      setData(result);
    });
  }, []);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  const handleSaved = () => {
    setOpenCreate(false);
    setEditing(null);
    loadPeriods();
  };

  const periodsBySemester = useMemo(() => {
    const periods = data?.periods ?? [];
    const groups = new Map<
      string,
      { semesterLabel: string; periods: PeriodItem[] }
    >();

    for (const period of periods) {
      const key = String(period.semesterId);
      const current = groups.get(key);
      if (current) {
        current.periods.push(period);
      } else {
        groups.set(key, {
          semesterLabel: period.semesterLabel,
          periods: [period],
        });
      }
    }

    return Array.from(groups.values());
  }, [data?.periods]);

  async function handleEnsureTemplate() {
    setEnsuring(true);
    const [, err] = await ensurePeriodsFromTemplateAction();
    setEnsuring(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success("Périodes initialisées depuis le modèle de la branche.");
    loadPeriods();
  }

  async function handleDelete(period: PeriodItem) {
    if (!period.canDelete) {
      toast.error(
        "Impossible de supprimer : des fiches ou des notes sont liées.",
      );
      return;
    }
    setDeletingId(period.id);
    const [, err] = await deletePeriodSettingsAction({ id: period.id });
    setDeletingId(null);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success("Période supprimée.");
    loadPeriods();
  }

  const semesters = data?.semesters ?? [];
  const hasSemesters = semesters.length > 0;
  const hasPeriods = (data?.periods.length ?? 0) > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">Périodes scolaires</h2>
            <Badge
              variant="outline-primary"
              icon={<IconCalendarEvent size={14} />}
            >
              {data?.structureLabel ?? "Paramètres"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez les périodes de notes et d&apos;examens pour cette branche.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={ensuring || isPending}
            onClick={() => void handleEnsureTemplate()}
          >
            <IconRefresh size={16} className="mr-2" />
            {ensuring ? "Initialisation…" : "Initialiser depuis le modèle"}
          </Button>
          <Button
            type="button"
            onClick={() => setOpenCreate(true)}
            disabled={!hasSemesters}
          >
            <IconPlus size={16} className="mr-2" />
            Ajouter
          </Button>
        </div>
      </div>

      {!hasSemesters && !isPending ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="font-medium">Aucun semestre / trimestre configuré</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Initialisez d&apos;abord le modèle adapté au type de cette branche,
            puis ajoutez ou ajustez les périodes.
          </p>
          <Button
            type="button"
            className="mt-4"
            disabled={ensuring}
            onClick={() => void handleEnsureTemplate()}
          >
            <IconRefresh size={16} className="mr-2" />
            Initialiser depuis le modèle
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Libellé</th>
              <th className="px-3 py-2 font-medium">Groupe</th>
              <th className="px-3 py-2 font-medium">Début</th>
              <th className="px-3 py-2 font-medium">Fin</th>
              <th className="px-3 py-2 font-medium">Notes</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {periodsBySemester.map((group) =>
              group.periods.map((period, index) => (
                <tr key={period.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{period.label}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {index === 0 ? group.semesterLabel : ""}
                  </td>
                  <td className="px-3 py-2">
                    {formatDisplayDate(period.startDate)}
                  </td>
                  <td className="px-3 py-2">
                    {formatDisplayDate(period.endDate)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={period.gradesGenerated ? "default" : "secondary"}
                      className="rounded-full"
                    >
                      {period.gradesGenerated ? "Générées" : "Non générées"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(period)}
                      >
                        Modifier
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!period.canDelete || deletingId === period.id}
                        onClick={() => void handleDelete(period)}
                        title={
                          period.canDelete
                            ? "Supprimer"
                            : "Fiches ou notes liées"
                        }
                      >
                        <IconTrash size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              )),
            )}

            {!hasPeriods && (
              <tr>
                <td
                  className="px-3 py-8 text-center text-muted-foreground"
                  colSpan={6}
                >
                  {isPending
                    ? "Chargement..."
                    : "Aucune période configurée pour cette branche."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={openCreate} onOpenChange={setOpenCreate}>
        <SheetContent
          side="right"
          className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
        >
          <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
            <SheetTitle>Ajouter une période</SheetTitle>
            <SheetDescription>
              Créez une période de notes ou d&apos;examen pour cette branche.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <PeriodUpForm
              mode="create"
              semesters={semesters}
              onCreated={handleSaved}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <SheetContent
          side="right"
          className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
        >
          <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
            <SheetTitle>Modifier la période</SheetTitle>
            <SheetDescription>
              Ajustez le libellé, le groupe et les dates, puis enregistrez.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            {editing ? (
              <PeriodUpForm
                mode="update"
                semesters={semesters}
                initialData={{
                  id: editing.id,
                  label: editing.label,
                  semesterId: String(editing.semesterId),
                  startDate: editing.startDate,
                  endDate: editing.endDate,
                }}
                onUpdated={handleSaved}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
