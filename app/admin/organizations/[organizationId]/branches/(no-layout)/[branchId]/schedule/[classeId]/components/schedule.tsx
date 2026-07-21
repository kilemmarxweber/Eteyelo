"use client";

import { useState, useMemo, useEffect, useCallback, HTMLAttributes } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Download, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createScheduleAction,
  archiveScheduleAction,
  getScheduleCoursByClasseAction,
  getScheduleCreneauByClasseAction,
  getScheduleReportContextAction,
  getSchedulesByClasseAction,
} from "../../schedule.action";
import { ICours } from "@/src/interfaces/Cours";
import { z } from "zod";
import { scheduleSchema } from "@/src/interfaces/Schedule";
import { genererCreneaux } from "@/src/hooks/getCourseHours";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import { canManageOrganization } from "@/lib/auth/session-roles";
import {
  exportSchedulePdf,
  findScheduleConflicts,
  type ScheduleReportContext,
} from "./export-schedule-pdf";

export const Day = {
  Lundi: "Lundi",
  Mardi: "Mardi",
  Mercredi: "Mercredi",
  Jeudi: "Jeudi",
  Vendredi: "Vendredi",
  Samedi: "Samedi",
} as const;

export type DayType = (typeof Day)[keyof typeof Day];

type Horaire = {
  id: string;
  jour: string;
  cours: ICours;
  teacherLastName: string;
  teacherName: string;
  heureDebut: string;
  heureFin: string;
};

type CellTarget = {
  jour: DayType;
  heureDebut: string;
  heureFin: string;
};

interface ScheduleUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onScheduleAction?: () => void;
  initialData?: z.infer<typeof scheduleSchema>;
  classeId?: string;
  mode: "create" | "update";
}

const JOURS = Day;

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function buildDisplayTimeSlots(slots: string[], recreationHour: string) {
  const uniqueSlots = new Set(slots.filter(Boolean));
  if (recreationHour) {
    uniqueSlots.add(recreationHour);
  }
  return Array.from(uniqueSlots).sort(
    (a, b) => timeToMinutes(a) - timeToMinutes(b),
  );
}

function formatSlotRange(
  heure: string,
  displaySlots: string[],
  index: number,
  endTime: string,
) {
  return `${heure} - ${displaySlots[index + 1] || endTime}`;
}

export default function Schedule({
  className,
  onScheduleAction,
  classeId,
  ...props
}: ScheduleUpFormProps) {
  const params = useParams<{ organizationId: string; branchId: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [horaires, setHoraires] = useState<Horaire[]>([]);
  const [Cours, setCours] = useState<ICours[]>([]);
  const [heuresDebut, setHeuresDebut] = useState<string[]>([]);
  const [recreationHour, setRecreationHour] = useState("");
  const [endTime, setEndTime] = useState("");
  const [hasCreneau, setHasCreneau] = useState(true);
  const [reportContext, setReportContext] =
    useState<ScheduleReportContext | null>(null);
  const [exporting, setExporting] = useState(false);
  const [cellTarget, setCellTarget] = useState<CellTarget | null>(null);
  const [selectedCours, setSelectedCours] = useState("");

  const { data: session } = useSession();
  const canManageSchedules = canManageOrganization(session);
  const canCreateSchedule = canManageSchedules;
  const canDeleteSchedule = canManageSchedules;

  const vacationHref = `/admin/organizations/${params.organizationId}/branches/${params.branchId}/creneau`;
  const settingsHref = `/admin/organizations/${params.organizationId}/branches/${params.branchId}/settings/horaires`;

  const displayHeuresDebut = useMemo(
    () => buildDisplayTimeSlots(heuresDebut, recreationHour),
    [heuresDebut, recreationHour],
  );

  const loadHoraires = useCallback(async () => {
    if (!classeId) return;
    const [schedules, err] = await getSchedulesByClasseAction({ classeId });
    if (err) throw new Error("Failed to fetch schedules");
    setHoraires(
      schedules.map((schedule) => ({
        id: schedule.id,
        jour: schedule.day,
        cours: schedule.cours as ICours,
        teacherLastName: schedule.teacher?.nom ?? "",
        teacherName: [
          schedule.teacher?.nom,
          schedule.teacher?.postnom,
          schedule.teacher?.prenom,
        ]
          .filter(Boolean)
          .join(" "),
        heureDebut: schedule.hour,
        heureFin: "",
      })),
    );
  }, [classeId]);

  useEffect(() => {
    if (!classeId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const [coursResult, creneauResult, reportResult] = await Promise.all([
          getScheduleCoursByClasseAction({ classeId }),
          getScheduleCreneauByClasseAction({ classeId }),
          getScheduleReportContextAction({ classeId }),
        ]);

        const [rawCours, coursErr] = coursResult;
        if (coursErr) throw new Error("Failed to fetch cours");
        setCours(rawCours);

        const [creneaux, creneauErr] = creneauResult;
        if (creneauErr) throw new Error("Failed to fetch créneaux");
        if (Array.isArray(creneaux) && creneaux.length > 0) {
          setHasCreneau(true);
          const startTime = new Date(`2000-01-01T${creneaux[0].startTime}`);
          const vacationEnd = new Date(`2000-01-01T${creneaux[0].endTime}`);
          const recreationStart = new Date(
            `2000-01-01T${creneaux[0].recreationHour}`,
          );
          const generatedTimes = genererCreneaux(
            startTime,
            vacationEnd,
            creneaux[0].durationCourse,
            recreationStart,
            creneaux[0].recreationDuration,
          );
          setHeuresDebut(generatedTimes);
          setRecreationHour(creneaux[0].recreationHour);
          setEndTime(creneaux[0].endTime);
        } else {
          setHasCreneau(false);
          setHeuresDebut([]);
          setRecreationHour("");
          setEndTime("");
        }

        const [context, reportErr] = reportResult;
        if (reportErr || !context) {
          toast.error("Impossible de charger les informations du rapport.");
        } else {
          setReportContext(context);
        }

        await loadHoraires();
      } catch (error) {
        console.error(error);
        toast.error("Impossible de charger l'horaire.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [classeId, loadHoraires]);

  const uniqueCours = useMemo(() => {
    const map = new Map<string, ICours>();
    Cours.forEach((c) => {
      if (!map.has(c.id)) map.set(c.id, c);
    });
    return Array.from(map.values());
  }, [Cours]);

  const reportEntries = useMemo(
    () =>
      horaires.map((horaire) => ({
        id: horaire.id,
        day: horaire.jour,
        startTime: horaire.heureDebut,
        courseName: horaire.cours.nameCours,
        teacherName: horaire.teacherName,
      })),
    [horaires],
  );
  const conflicts = useMemo(
    () => findScheduleConflicts(reportEntries),
    [reportEntries],
  );

  function openCell(jour: DayType, heureDebut: string, heureFin: string) {
    if (!canCreateSchedule) return;
    setCellTarget({ jour, heureDebut, heureFin });
    setSelectedCours("");
  }

  function closeCellDialog() {
    setCellTarget(null);
    setSelectedCours("");
  }

  async function assignCourse() {
    if (!canCreateSchedule || !cellTarget || !selectedCours || !classeId) return;

    const conflit = horaires.some(
      (h) =>
        h.jour === cellTarget.jour && h.heureDebut === cellTarget.heureDebut,
    );
    if (conflit) {
      toast.warning(
        `Cette case est déjà occupée (${cellTarget.jour} à ${cellTarget.heureDebut}).`,
      );
      return;
    }

    setSaving(true);
    try {
      const [, err] = await createScheduleAction({
        day: cellTarget.jour,
        coursId: selectedCours,
        hour: cellTarget.heureDebut,
        classeId,
        createdBy: "",
      });
      if (err) throw err;

      await loadHoraires();
      onScheduleAction?.();
      toast.success("Cours placé dans l'horaire");
      closeCellDialog();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "Erreur lors de l'enregistrement de l'horaire";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function desactiverHoraire(id: string) {
    if (!canDeleteSchedule) {
      toast.error("Action non autorisee");
      return;
    }
    if (
      !window.confirm(
        "Retirer ce cours de l'horaire ? L'historique sera conserve.",
      )
    ) {
      return;
    }

    try {
      const [, err] = await archiveScheduleAction({ id });
      if (err) throw err;
      setHoraires((prev) => prev.filter((horaire) => horaire.id !== id));
      toast.success("Cours retire de l'horaire");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  }

  async function handleExportPdf() {
    if (!reportContext || !horaires.length) return;
    setExporting(true);
    try {
      await exportSchedulePdf({
        context: reportContext,
        days: Object.values(JOURS),
        timeSlots: displayHeuresDebut,
        recreationHour,
        endTime,
        entries: reportEntries,
      });
      toast.success("Le rapport PDF a ete genere.");
    } catch (error) {
      console.error(error);
      toast.error("Impossible de generer le rapport PDF.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Card
        className={`mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden ${className ?? ""}`}
        {...props}
      >
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Horaire hebdomadaire</CardTitle>
              {reportContext && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {reportContext.classeName}
                  {reportContext.academicYearLabel
                    ? ` · ${reportContext.academicYearLabel}`
                    : ""}
                </p>
              )}
              {canCreateSchedule && hasCreneau && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Cliquez sur une case vide pour y placer un cours (lundi à
                  samedi).
                </p>
              )}
            </div>
            <Button
              type="button"
              onClick={handleExportPdf}
              disabled={
                loading || exporting || horaires.length === 0 || !reportContext
              }
            >
              <Download className="mr-2 size-4" />
              {exporting ? "Generation..." : "Telecharger"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 overflow-y-auto">
          {conflicts.length > 0 && (
            <div className="mb-4 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">
                  {conflicts.length} conflit(s) detecte(s) dans l&apos;horaire
                </p>
                <p>
                  Les cours concernes sont affiches ensemble et seront signales
                  dans le PDF.
                </p>
              </div>
            </div>
          )}

          {!loading && !hasCreneau && (
            <div className="mb-6 rounded-lg border border-dashed p-6 text-center">
              <p className="font-medium">Aucune vacation assignee a cette classe</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Configurez la structure de la journee (periodes et recreation)
                puis assignez une vacation a la classe.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button asChild variant="outline">
                  <Link href={settingsHref}>Parametres horaires</Link>
                </Button>
                <Button asChild>
                  <Link href={vacationHref}>Gerer les vacations</Link>
                </Button>
              </div>
            </div>
          )}

          {hasCreneau && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Heures</TableHead>
                    {Object.values(JOURS).map((jour) => (
                      <TableHead key={jour}>{jour}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayHeuresDebut.map((heure, index) =>
                    heure === recreationHour ? (
                      <TableRow key={heure}>
                        <TableCell
                          colSpan={Object.values(JOURS).length + 1}
                          className="bg-muted/40 text-center"
                        >
                          <span className="text-sm font-medium tracking-wide text-muted-foreground">
                            Recreation ({heure} –{" "}
                            {displayHeuresDebut[index + 1] || endTime})
                          </span>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={heure}>
                        <TableCell className="whitespace-nowrap text-sm font-medium">
                          {formatSlotRange(
                            heure,
                            displayHeuresDebut,
                            index,
                            endTime,
                          )}
                        </TableCell>
                        {Object.values(JOURS).map((jour) => {
                          const cellSchedules = horaires.filter(
                            (h) => h.jour === jour && h.heureDebut === heure,
                          );
                          const heureFin =
                            displayHeuresDebut[index + 1] || endTime;
                          const isEmpty = cellSchedules.length === 0;

                          return (
                            <TableCell
                              key={`${jour}-${heure}`}
                              className={
                                cellSchedules.length > 1
                                  ? "bg-destructive/10 text-destructive align-top"
                                  : "align-top"
                              }
                            >
                              {cellSchedules.map((horaire) => (
                                <div
                                  key={horaire.id}
                                  className="flex items-start justify-between gap-1 border-b py-1 last:border-b-0"
                                >
                                  <span>
                                    <span className="font-medium">
                                      {horaire.cours.nameCours}
                                    </span>
                                    {horaire.teacherName && (
                                      <span className="block text-xs text-muted-foreground">
                                        {horaire.teacherName}
                                      </span>
                                    )}
                                  </span>
                                  {canDeleteSchedule && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 shrink-0"
                                      onClick={() =>
                                        desactiverHoraire(horaire.id)
                                      }
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Retirer</span>
                                    </Button>
                                  )}
                                </div>
                              ))}
                              {isEmpty && canCreateSchedule && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openCell(jour, heure, heureFin)
                                  }
                                  className="flex w-full min-h-14 items-center justify-center rounded-md border border-dashed border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
                                >
                                  <Plus className="size-4" />
                                  <span className="sr-only">
                                    Ajouter un cours le {jour} a {heure}
                                  </span>
                                </button>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ),
                  )}
                  {endTime && (
                    <TableRow className="bg-muted/40">
                      <TableCell
                        colSpan={Object.values(JOURS).length + 1}
                        className="py-3 text-center text-sm font-semibold"
                      >
                        Fin des cours · {endTime}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {horaires.length === 0 && !loading && hasCreneau && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {canCreateSchedule
                ? "Aucun cours planifie. Cliquez sur une case pour commencer."
                : "Aucun horaire disponible pour cette classe."}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(cellTarget)}
        onOpenChange={(open) => {
          if (!open) closeCellDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Placer un cours</DialogTitle>
            <DialogDescription>
              {cellTarget
                ? `${cellTarget.jour} · ${cellTarget.heureDebut} – ${cellTarget.heureFin}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="cours-cell">Cours</Label>
            <Select value={selectedCours} onValueChange={setSelectedCours}>
              <SelectTrigger id="cours-cell">
                <SelectValue placeholder="Choisir un cours" />
              </SelectTrigger>
              <SelectContent>
                {uniqueCours.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nameCours}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {uniqueCours.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun cours affecte a cette classe. Ajoutez d&apos;abord une
                affectation enseignant.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeCellDialog}>
              Annuler
            </Button>
            <Button
              type="button"
              disabled={!selectedCours || saving || uniqueCours.length === 0}
              onClick={assignCourse}
            >
              {saving ? "Enregistrement..." : "Placer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
