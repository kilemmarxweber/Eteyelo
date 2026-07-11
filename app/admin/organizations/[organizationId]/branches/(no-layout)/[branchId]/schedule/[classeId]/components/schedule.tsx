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
import { Trash2 } from "lucide-react";
import {
  createScheduleAction,
  archiveScheduleAction,
  getScheduleCoursByClasseAction,
  getScheduleCreneauByClasseAction,
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

type Horaire = {
  id: string;
  jour: string;
  cours: ICours;
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
  const [selectedCours, setSelectedCours] = useState<string>("");
  const [heuresDebut, setHeuresDebut] = useState<string[]>([]);
  const [jour, setJour] = useState<"" | DayType>("");
  const [recreationHour, setRecreationHour] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
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
          heureDebut: schedule.hour,
          heureFin: "", // Vous pouvez calculer l'heure de fin si nécessaire
        }));
        setHoraires(horaires as Horaire[]);
      } catch (error) {
        console.error("Erreur de récupération des horaires", error);
      }
    };

    fetchCours();
    fetchCreneaux();
    fetchHoraires();
  }, [classeId]);

  useEffect(() => {
    if (heureDebut) {
      const index = displayHeuresDebut.indexOf(heureDebut);
      if (index !== -1 && index + 1 < displayHeuresDebut.length) {
        setHeureFin(displayHeuresDebut[index + 1]);
      } else {
        setHeureFin("");
      }
    }
  }, [displayHeuresDebut, heureDebut]);

  const ajouterHoraire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateSchedule) {
      toast.error("Action non autorisee");
      return;
    }

    if (!jour || !selectedCours || !heureDebut || !heureFin || !classeId)
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

  const supprimerHoraire = async (id: string) => {
    if (!canDeleteSchedule) {
      toast.error("Action non autorisee");
      return;
    }

    try {
      const [, err] = await archiveScheduleAction({ id });
      if (err) throw err;

      setHoraires(horaires.filter((horaire) => horaire.id !== id));
      toast.success("Horaire supprimer avec succes");
    } catch (error) {
      toast.error("Erreur lors de la suppression");
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

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle>Horaires de Cours Hebdomadaires</CardTitle>
      </CardHeader>
      <CardContent>
        {canCreateSchedule && (
          <form onSubmit={ajouterHoraire} className="space-y-4 mb-6">
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

        <div className="overflow-x-auto">
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
                      const horaire = horaires.find(
                        (h) => h.jour === jour && h.heureDebut === heure,
                      );
                      return (
                        <TableCell key={`${jour}-${heure}`}>
                          {horaire && (
                            <div className="flex items-center ">
                              <span>{horaire.cours.nameCours}</span>
                              {canDeleteSchedule && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => supprimerHoraire(horaire.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Masquer</span>
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
