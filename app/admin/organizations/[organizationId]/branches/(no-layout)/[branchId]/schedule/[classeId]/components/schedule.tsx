"use client";

import { useState, useMemo, useEffect, HTMLAttributes } from "react";
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
import { AlertTriangle, Download, Printer, Trash2 } from "lucide-react";
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

// type DayType = (typeof Day)[keyof typeof Day];
// src/constants/day.ts

export const Day = {
  Lundi: "Lundi",
  Mardi: "Mardi",
  Mercredi: "Mercredi",
  Jeudi: "Jeudi",
  Vendredi: "Vendredi",
  Samedi: "Samedi",
} as const;

export type DayType = (typeof Day)[keyof typeof Day];

import { genererCreneaux } from "@/src/hooks/getCourseHours";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import { canManageOrganization } from "@/lib/auth/session-roles";
import {
  exportSchedulePdf,
  findScheduleConflicts,
  type ScheduleReportContext,
} from "./export-schedule-pdf";

type Horaire = {
  id: string;
  jour: string;
  cours: ICours;
  teacherLastName: string;
  teacherName: string;
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

export default function Schedule({
  className,
  onScheduleAction,
  initialData,
  mode,
  classeId,
  ...props
}: ScheduleUpFormProps) {
  const [loading, setLoading] = useState(true);
  const [horaires, setHoraires] = useState<Horaire[]>([]);
  const [Cours, setCours] = useState<ICours[]>([]);
  const [heureDebut, setHeureDebut] = useState("");
  const [heureFin, setHeureFin] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [missingEndTimeDialogOpen, setMissingEndTimeDialogOpen] =
    useState(false);
  const [selectedCours, setSelectedCours] = useState<string>("");
  const [heuresDebut, setHeuresDebut] = useState<string[]>([]);
  const [jour, setJour] = useState<"" | DayType>("");
  const [recreationHour, setRecreationHour] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [reportContext, setReportContext] =
    useState<ScheduleReportContext | null>(null);
  const [exporting, setExporting] = useState(false);
  const DAY_VALUES = Object.values(Day) as DayType[];
  const { data: session } = useSession();
  const canManageSchedules = canManageOrganization(session);
  const canCreateSchedule = canManageSchedules;
  const canDeleteSchedule = canManageSchedules;
  const displayHeuresDebut = useMemo(
    () => buildDisplayTimeSlots(heuresDebut, recreationHour),
    [heuresDebut, recreationHour],
  );

  useEffect(() => {
    if (!classeId) {
      setLoading(false);
      return;
    }
    const fetchCours = async () => {
      try {
        const [rawCours, err] = await getScheduleCoursByClasseAction({
          classeId: classeId || "",
        });
        if (err) throw new Error("Failed to fetch cours");
        setCours(rawCours);
      } catch (error) {
        console.error("Erreur de récupération des cours", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchCreneaux = async () => {
      try {
        const [creneaux, err] = await getScheduleCreneauByClasseAction({
          classeId: classeId || "",
        }); // Utiliser getAllCreneauxAction ici
        if (err) throw new Error("Failed to fetch créneaux");
        if (
          (Array.isArray(creneaux) && creneaux.length > 0) ||
          typeof creneaux[0] === "object"
        ) {
          const startTime = new Date(`2000-01-01T${creneaux[0].startTime}`);
          const endTime = new Date(`2000-01-01T${creneaux[0].endTime}`);
          const durationCourse = creneaux[0].durationCourse;
          const recreationHour = new Date(
            `2000-01-01T${creneaux[0].recreationHour}`,
          );
          const recreationDuration = creneaux[0].recreationDuration;

          const generatedTimes = genererCreneaux(
            startTime,
            endTime,
            durationCourse,
            recreationHour,
            recreationDuration,
          );

          console.log("Generated times:", generatedTimes);
          setHeuresDebut(generatedTimes);
          setRecreationHour(creneaux[0].recreationHour); // Mettre à jour l'heure de récréation
          setEndTime(creneaux[0].endTime); // Mettre à jour l'heure de fin des cours
        }
      } catch (error) {
        console.error("Erreur de récupération des créneaux", error);
      }
    };

    const fetchHoraires = async () => {
      try {
        const [schedules, err] = await getSchedulesByClasseAction({
          classeId: classeId || "",
        });
        if (err) throw new Error("Failed to fetch schedules");
        const horaires = schedules.map((schedule) => ({
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
          heureFin: "", // Vous pouvez calculer l'heure de fin si nécessaire
        }));
        setHoraires(horaires as Horaire[]);
      } catch (error) {
        console.error("Erreur de récupération des horaires", error);
      }
    };

    const fetchReportContext = async () => {
      const [context, err] = await getScheduleReportContextAction({ classeId });
      if (err || !context) {
        toast.error("Impossible de charger les informations du rapport.");
        return;
      }
      setReportContext(context);
    };

    fetchCours();
    fetchCreneaux();
    fetchHoraires();
    fetchReportContext();
  }, [classeId]);

  useEffect(() => {
    if (heureDebut) {
      const index = displayHeuresDebut.indexOf(heureDebut);
      if (index !== -1) {
        setHeureFin(displayHeuresDebut[index + 1] || endTime);
        setAlertMessage("");
      } else {
        setHeureFin("");
      }
    }
  }, [displayHeuresDebut, endTime, heureDebut]);

  const ajouterHoraire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateSchedule) {
      toast.error("Action non autorisee");
      return;
    }

    if (!heureFin) {
      const message =
        "L'heure de fin est introuvable. Vérifiez l'heure de fin de la vacation et la durée du cours dans les créneaux de cette classe.";
      setAlertMessage(message);
      setMissingEndTimeDialogOpen(true);
      return;
    }

    if (!jour || !selectedCours || !heureDebut || !classeId)
      return;

    const coursChoisi = Cours.find((c) => c.id === selectedCours);
    if (!coursChoisi) {
      setAlertMessage("Cours non trouvé");
      return;
    }

    const conflit = horaires.some(
      (h) => h.jour === jour && h.heureDebut === heureDebut,
    );
    if (conflit) {
      toast.warning(`Conflit : ${jour} à ${heureDebut}.`);
    } else {
      try {
        const [createdSchedule, err] = await createScheduleAction({
          day: jour,
          coursId: selectedCours,
          hour: heureDebut,
          classeId,
          createdBy: "",
        });

        if (err) {
          console.log(err);
          throw err;
        }

        setHoraires([
          ...horaires,
          {
            id: createdSchedule.id,
            jour,
            cours: coursChoisi,
            teacherLastName: "",
            teacherName: "",
            heureDebut,
            heureFin,
          },
        ]);
        setJour("");
        setSelectedCours("");
        setHeureDebut("");
        setHeureFin("");
        setAlertMessage("");
        if (onScheduleAction) onScheduleAction();
        toast.success("Horaire ajoutée avec succes");
      } catch (error) {
        console.error("Erreur d'enregistrement :", error);
        toast.error("Erreur lors de l'enregistrement de l'horaire");
      }
    }
  };

  const desactiverHoraire = async (id: string) => {
    if (!canDeleteSchedule) {
      toast.error("Action non autorisee");
      return;
    }

    if (
      !window.confirm(
        "Desactiver cet horaire ? Il sera masque des listes actives mais l'historique sera conserve.",
      )
    ) {
      return;
    }

    try {
      const [, err] = await archiveScheduleAction({ id });
      if (err) throw err;

      setHoraires(horaires.filter((horaire) => horaire.id !== id));
      toast.success("Horaire desactive avec succes");
    } catch (error) {
      toast.error("Erreur lors de la desactivation");
    }
  };

  const handleValueChange = (value: string) => {
    if (value === "" || (DAY_VALUES as string[]).includes(value)) {
      setJour(value as "" | DayType);
    }
  };
  const uniqueCours = useMemo(() => {
    const map = new Map<string, ICours>();
    Cours.forEach((c) => {
      if (!map.has(c.id)) {
        map.set(c.id, c);
      }
    });
    return Array.from(map.values());
  }, [Cours]);
  const filteredHeuresDebut = displayHeuresDebut.filter(
    (h) => h !== recreationHour,
  );
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
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body * {
            visibility: hidden !important;
          }
          .schedule-print-area,
          .schedule-print-area * {
            visibility: visible !important;
          }
          .schedule-print-area {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
          }
        }
      `}</style>
      <Card
        className="schedule-print-area mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden print:block print:max-h-none print:max-w-none print:overflow-visible print:border-0 print:shadow-none"
      >
        <CardHeader className="gap-4 print:px-0 print:pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Horaires de cours hebdomadaires</CardTitle>
            {reportContext && (
              <p className="mt-1 text-sm text-muted-foreground">
                {reportContext.classeName}
                {reportContext.schoolYearName
                  ? ` · ${reportContext.schoolYearName}`
                  : ""}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.print()}
              disabled={loading || horaires.length === 0}
            >
              <Printer className="mr-2 size-4" />
              Imprimer
            </Button>
            <Button
              type="button"
              onClick={handleExportPdf}
              disabled={loading || exporting || horaires.length === 0 || !reportContext}
            >
              <Download className="mr-2 size-4" />
              {exporting ? "Generation..." : "Telecharger le PDF"}
            </Button>
          </div>
        </div>
        {reportContext && (
          <div className="hidden border-b pb-3 text-center print:block">
            {reportContext.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={reportContext.logoUrl}
                alt="Logo de la branche"
                className="mx-auto mb-1 h-12 w-12 object-contain"
              />
            )}
            <p className="text-sm font-semibold">{reportContext.organizationName}</p>
            <p className="text-base font-bold">{reportContext.branchName}</p>
            <p className="mt-1 text-lg font-bold">
              Horaire de la classe {reportContext.classeName}
            </p>
            <p className="text-xs">
              {[reportContext.schoolYearName, reportContext.creneauName]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        )}
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto print:overflow-visible print:px-0">
        {conflicts.length > 0 && (
          <div className="mb-4 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive print:border-red-500 print:bg-red-50 print:text-red-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">
                {conflicts.length} conflit(s) detecte(s) dans l'horaire
              </p>
              <p>
                Les cours concernes sont affiches ensemble et seront signales dans le PDF.
              </p>
            </div>
          </div>
        )}
        {canCreateSchedule && (
          <form onSubmit={ajouterHoraire} className="mb-6 space-y-4 print:hidden">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jour">Jour</Label>
                <Select value={jour} onValueChange={handleValueChange}>
                  <SelectTrigger id="jour">
                    <SelectValue placeholder="Sélectionnez un jour" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(JOURS).map((j) => (
                      <SelectItem key={j} value={j}>
                        {j}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cours">Cours</Label>
                <Select value={selectedCours} onValueChange={setSelectedCours}>
                  <SelectTrigger id="cours">
                    <SelectValue placeholder="Sélectionnez un cours" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueCours.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nameCours}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="heureDebut">Heure de début</Label>
                <Select value={heureDebut} onValueChange={setHeureDebut}>
                  <SelectTrigger id="heureDebut">
                    <SelectValue placeholder="Heure de début" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredHeuresDebut.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="heureFin">Heure de fin</Label>
                <Select value={heureFin} disabled>
                  <SelectTrigger id="heureFin">
                    <SelectValue placeholder="Heure de fin" />
                  </SelectTrigger>
                  <SelectContent>
                    {displayHeuresDebut.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full">
              Ajouter l'horaire
            </Button>
          </form>
        )}

        <div className="overflow-x-auto print:overflow-visible">
          <Table>
            <TableHeader>
              <TableRow className="w-[100px]">
                <TableHead className="w-[150px]">Heures</TableHead>
                {Object.values(JOURS).map((jour) => (
                  <TableHead key={jour}>{jour}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayHeuresDebut.map((heure, index) =>
                heure === recreationHour ? ( // Utiliser recreationHour ici
                  <TableRow key={heure}>
                    <TableCell
                      colSpan={Object.values(JOURS).length + 1}
                      className="text-center "
                    >
                      <span className="text-2xl tracking-widest	">
                        R É C R É A T I O N ({heure} -{" "}
                        {displayHeuresDebut[index + 1] || endTime})
                      </span>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={heure}>
                    <TableCell>
                      {`${heure} - ${displayHeuresDebut[index + 1] || endTime}`}
                    </TableCell>
                    {Object.values(JOURS).map((jour) => {
                      const cellSchedules = horaires.filter(
                        (h) => h.jour === jour && h.heureDebut === heure,
                      );
                      return (
                        <TableCell
                          key={`${jour}-${heure}`}
                          className={
                            cellSchedules.length > 1
                              ? "bg-destructive/10 text-destructive print:bg-red-50 print:text-red-800"
                              : undefined
                          }
                        >
                          {cellSchedules.map((horaire) => (
                            <div
                              key={horaire.id}
                              className="flex items-start justify-start gap-1 border-b py-1 last:border-b-0"
                            >
                              <span>
                                <span className="font-medium">
                                  {horaire.cours.nameCours}
                                </span>
                                {horaire.teacherName && (
                                  <span className="block text-xs text-muted-foreground print:text-slate-600">
                                    {horaire.teacherName}
                                  </span>
                                )}
                              </span>
                              {canDeleteSchedule && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 shrink-0 print:hidden"
                                  onClick={() => desactiverHoraire(horaire.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Desactiver</span>
                                </Button>
                              )}
                            </div>
                          ))}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ),
              )}
              {endTime && (
                <TableRow className="bg-muted/40 print:bg-slate-100">
                  <TableCell
                    colSpan={Object.values(JOURS).length + 1}
                    className="py-3 text-center font-semibold"
                  >
                    FIN DES COURS · {endTime}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {horaires.length === 0 && !loading && (
          <p className="py-8 text-center text-sm text-muted-foreground print:hidden">
            Aucun horaire disponible pour cette classe.
          </p>
        )}
        <div className="mt-4 hidden justify-between border-t pt-2 text-[10px] text-slate-500 print:flex">
          <span>Imprime le {new Date().toLocaleString("fr-FR")}</span>
          <span>{reportContext?.branchName}</span>
        </div>
        </CardContent>
      </Card>
      <Dialog
        open={missingEndTimeDialogOpen}
        onOpenChange={setMissingEndTimeDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Heure de fin manquante</DialogTitle>
            <DialogDescription>
              {alertMessage ||
                "Impossible d'ajouter ce cours sans une heure de fin valide."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setMissingEndTimeDialogOpen(false)}
            >
              Compris
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
