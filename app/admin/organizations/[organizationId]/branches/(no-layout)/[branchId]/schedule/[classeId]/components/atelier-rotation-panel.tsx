"use client";

/**
 * Créneaux en rotation (atelier uniquement).
 *
 * Rotation active seulement si ≥ 2 cours le même jour/créneau
 * (ex. Lundi 08:00–10:00 → Chimie sem. 1, Biologie sem. 2).
 * Un seul cours = horaire classique, pas de rotation.
 * Affichage : après la fin du créneau (ex. 10h), le cours suivant
 * de la journée est mis devant.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  deleteRotationSlotAction,
  getResolvedRotationSlotsAction,
  getRotationFormOptionsAction,
  upsertRotationSlotAction,
} from "../../rotation.action";
import { cn } from "@/lib/utils";

type RotationRow = {
  id: string;
  day: string;
  hour: string;
  hourEnd: string;
  durationMinutes: number;
  phase: "current" | "upcoming" | "past";
  practicalDomainId: string;
  domainName: string;
  roomId: string | null;
  roomName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  anchorDate: string;
  isRotating: boolean;
  cycleLength: number;
  weekInCycle: number;
  advancedAfterEnd?: boolean;
  isClosed: boolean;
  coursId: string | null;
  nameCours: string | null;
  label: string;
  items: Array<{
    coursId: string;
    nameCours: string;
    sortOrder: number;
    teacherId: string | null;
  }>;
};

type FormOptions = {
  domains: Array<{ id: string; name: string; code: string }>;
  rooms: Array<{
    id: string;
    name: string;
    practicalDomainId: string | null;
  }>;
  teachers: Array<{ id: string; name: string }>;
  coursesByDomain: Record<
    string,
    Array<{ id: string; nameCours: string; code: string | null }>
  >;
};

const DAYS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
] as const;

function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
    });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function toWeekDateIso(monday: Date): string {
  return monday.toISOString();
}

export function AtelierRotationPanel({
  classeId,
  syncToken = 0,
  onChanged,
}: {
  classeId: string;
  /** Incrémente quand la grille horaire change → recharge la liste. */
  syncToken?: number;
  onChanged?: () => void;
}) {
  const [weekMonday, setWeekMonday] = useState(() => mondayOf(new Date()));
  const [rows, setRows] = useState<RotationRow[]>([]);
  const [options, setOptions] = useState<FormOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RotationRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [day, setDay] = useState<string>("Lundi");
  const [hour, setHour] = useState("08:00");
  const [domainId, setDomainId] = useState("");
  const [roomId, setRoomId] = useState<string>("");
  const [teacherId, setTeacherId] = useState<string>("");
  const [anchorDate, setAnchorDate] = useState(() =>
    mondayOf(new Date()).toISOString().slice(0, 10),
  );
  /** Ordre du cycle : index 0 = semaine 1, etc. */
  const [cycleCoursIds, setCycleCoursIds] = useState<string[]>([]);

  const loadOptions = useCallback(async () => {
    try {
      const [optsRes] = await getRotationFormOptionsAction({ classeId });
      setOptions((optsRes as FormOptions) ?? null);
    } catch {
      /* ignore */
    }
  }, [classeId]);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const [slotsRes] = await getResolvedRotationSlotsAction({
        classeId,
        weekDate: toWeekDateIso(weekMonday),
      });
      setRows((slotsRes as RotationRow[]) ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [classeId, weekMonday]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    if (syncToken === 0) return;
    void loadSlots();
  }, [syncToken, loadSlots]);

  const load = loadSlots;

  const domainCourses = useMemo(
    () => (domainId && options ? options.coursesByDomain[domainId] ?? [] : []),
    [domainId, options],
  );

  const roomsForDomain = useMemo(
    () =>
      options?.rooms.filter(
        (r) => !r.practicalDomainId || r.practicalDomainId === domainId,
      ) ?? [],
    [options, domainId],
  );

  function resetForm() {
    setEditingId(null);
    setDay("Lundi");
    setHour("08:00");
    setDomainId("");
    setRoomId("");
    setTeacherId("");
    setAnchorDate(mondayOf(new Date()).toISOString().slice(0, 10));
    setCycleCoursIds([]);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(row: RotationRow) {
    setEditingId(row.id);
    setDay(row.day);
    setHour(row.hour);
    setDomainId(row.practicalDomainId);
    setRoomId(row.roomId ?? "");
    setTeacherId(row.teacherId ?? "");
    setAnchorDate(row.anchorDate);
    setCycleCoursIds(
      [...row.items]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((i) => i.coursId),
    );
    setShowForm(true);
  }

  function toggleCourseInCycle(coursId: string) {
    setCycleCoursIds((prev) => {
      if (prev.includes(coursId)) {
        return prev.filter((id) => id !== coursId);
      }
      return [...prev, coursId];
    });
  }

  function moveInCycle(coursId: string, dir: -1 | 1) {
    setCycleCoursIds((prev) => {
      const i = prev.indexOf(coursId);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function handleSave() {
    if (!domainId) {
      toast.error("Choisissez un domaine pratique");
      return;
    }
    if (cycleCoursIds.length === 0) {
      toast.error("Ajoutez au moins un cours");
      return;
    }
    setSaving(true);
    try {
      const [res, err] = await upsertRotationSlotAction({
        id: editingId ?? undefined,
        classeId,
        day: day as (typeof DAYS)[number],
        hour,
        practicalDomainId: domainId,
        roomId: roomId || null,
        teacherId: teacherId || null,
        anchorDate,
        items: cycleCoursIds.map((coursId, sortOrder) => ({
          coursId,
          sortOrder,
          teacherId: teacherId || null,
        })),
      });
      if (err) throw err;
      if (!res?.id) throw new Error("Échec de l'enregistrement");
      toast.success(
        editingId
          ? "Créneau rotation mis à jour"
          : "Créneau rotation créé — même horaire, cours selon la semaine",
      );
      setShowForm(false);
      resetForm();
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const [res, err] = await deleteRotationSlotAction({ id: deleteTarget.id });
      if (err) throw err;
      if (!res?.ok) throw new Error("Échec de la suppression");
      toast.success("Créneau rotation supprimé");
      setDeleteTarget(null);
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setDeleting(false);
    }
  }

  const isCurrentWeek =
    mondayOf(new Date()).toISOString().slice(0, 10) ===
    weekMonday.toISOString().slice(0, 10);

  return (
    <div className="mt-8 rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold text-amber-950 dark:text-amber-100">
            Horaires en rotation (atelier)
          </h3>
          <p className="max-w-7xl text-sm text-muted-foreground">
            Placez 1 ou 2 cours sur un créneau (grille ci-dessus ou formulaire).
            <strong className="font-medium text-foreground"> 2 cours</strong>{" "}
            (ex. Chimie / Biologie) → rotation semaine actuelle / suivante.{" "}
            <strong className="font-medium text-foreground">1 cours</strong> →
            créneau fixe. Après la fin d&apos;un créneau (ex. 10h), le suivant
            remonte devant.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={openCreate}
        >
          <Plus className="size-4" />
          Nouveau créneau
        </Button>
      </div>

      {/* Navigateur de semaine */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border bg-background/80 px-2 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setWeekMonday((m) => addDays(m, -7))}
          aria-label="Semaine précédente"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="min-w-[10rem] flex-1 text-center text-sm font-medium">
          {formatWeekRange(weekMonday)}
          {isCurrentWeek ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (cette semaine)
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setWeekMonday((m) => addDays(m, 7))}
          aria-label="Semaine suivante"
        >
          <ChevronRight className="size-4" />
        </Button>
        {!isCurrentWeek ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setWeekMonday(mondayOf(new Date()))}
          >
            Aujourd&apos;hui
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Chargement…
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Aucune rotation. Placez au moins deux cours le même jour pour activer
          l&apos;alternance. Un seul cours reste dans l&apos;horaire classique.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => {
            const ordered = [...row.items].sort(
              (a, b) => a.sortOrder - b.sortOrder,
            );
            const phaseLabel =
              row.phase === "current"
                ? "En cours"
                : row.phase === "upcoming"
                  ? "Suivant"
                  : "Terminé";
            return (
              <li
                key={row.id}
                className={cn(
                  "rounded-lg border bg-background px-3 py-2.5 text-sm shadow-sm",
                  row.isClosed && "opacity-60",
                  row.phase === "current" &&
                    "border-amber-400 ring-1 ring-amber-300/60",
                  row.phase === "upcoming" && "border-amber-200",
                  row.phase === "past" && "opacity-55",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1.5">
                    <div className="font-medium">
                      {row.day} · {row.hour}
                      {row.hourEnd ? ` – ${row.hourEnd}` : ""}
                      <span className="ml-2 font-normal text-muted-foreground">
                        · {row.domainName}
                        {row.roomName ? ` · ${row.roomName}` : ""}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-xs font-medium",
                          row.phase === "current" &&
                            "bg-amber-200 text-amber-950 dark:bg-amber-800 dark:text-amber-50",
                          row.phase === "upcoming" &&
                            "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
                          row.phase === "past" &&
                            "bg-muted text-muted-foreground",
                        )}
                      >
                        {phaseLabel}
                      </span>
                      {row.isRotating ? (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                          Rotation {row.weekInCycle}/{row.cycleLength}
                          {row.advancedAfterEnd ? " · S suivant actif" : ""}
                        </span>
                      ) : (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Sans rotation
                        </span>
                      )}
                      {row.isClosed ? (
                        <span className="text-muted-foreground">
                          Jour fermé — pas de cours
                        </span>
                      ) : (
                        <span>
                          {row.nameCours ?? "—"}
                          {row.teacherName ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {row.teacherName}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </div>

                    {row.isRotating && ordered.length > 1 ? (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
                        <span className="shrink-0">Cycle :</span>
                        {ordered.map((item, idx) => (
                          <span
                            key={`${row.id}-${item.coursId}-${idx}`}
                            className={cn(
                              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5",
                              !row.isClosed &&
                                row.weekInCycle === idx + 1 &&
                                "border-amber-400 bg-amber-50 font-medium text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-50",
                            )}
                          >
                            S{idx + 1} {item.nameCours}
                            {idx < ordered.length - 1 ? (
                              <span className="text-muted-foreground/60">→</span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => openEdit(row)}
                      aria-label="Modifier"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={() => setDeleteTarget(row)}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce créneau en rotation ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  {deleteTarget.domainName} · {deleteTarget.day} ·{" "}
                  {deleteTarget.hour}–{deleteTarget.hourEnd}
                  {deleteTarget.label ? ` · ${deleteTarget.label}` : ""}. Cette
                  action est définitive.
                </>
              ) : (
                "Cette action est définitive."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Suppression…
                </>
              ) : (
                "Supprimer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showForm ? (
        <div className="mt-4 space-y-3 rounded-lg border bg-background p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">
              {editingId ? "Modifier le créneau" : "Nouveau créneau en rotation"}
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Annuler
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Même jour et heure. 1 cours = fixe. 2 cours ou plus = rotation par
            semaine (cochez dans l&apos;ordre du cycle). Seuls les cours du
            domaine affectés à ce groupe sont proposés.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Jour</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Heure de début</Label>
              <Input
                type="time"
                value={hour}
                onChange={(e) => setHour(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ancre du cycle (lundi de départ)</Label>
              <Input
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Domaine pratique</Label>
              <Select
                value={domainId}
                onValueChange={(v) => {
                  setDomainId(v);
                  setCycleCoursIds([]);
                  setRoomId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {(options?.domains ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Salle (optionnel)</Label>
              <Select
                value={roomId || "__none__"}
                onValueChange={(v) => setRoomId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucune</SelectItem>
                  {roomsForDomain.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Enseignant (optionnel)</Label>
              <Select
                value={teacherId || "__none__"}
                onValueChange={(v) => setTeacherId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
                  {(options?.teachers ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {domainId ? (
            <div className="space-y-2 rounded-md border border-dashed p-3">
              <Label className="text-sm">
                Cours du cycle (cocher dans l&apos;ordre)
              </Label>
              {domainCourses.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucun cours de ce domaine affecté à ce groupe. Liez le cours au
                  domaine pratique, puis affectez-le au groupe (enseignement).
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {domainCourses.map((c) => {
                    const inCycle = cycleCoursIds.includes(c.id);
                    const pos = cycleCoursIds.indexOf(c.id);
                    return (
                      <li
                        key={c.id}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                          inCycle && "bg-amber-50 dark:bg-amber-950/30",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-amber-600"
                          checked={inCycle}
                          onChange={() => toggleCourseInCycle(c.id)}
                          id={`cycle-${c.id}`}
                        />
                        <label
                          htmlFor={`cycle-${c.id}`}
                          className="min-w-0 flex-1 cursor-pointer"
                        >
                          {inCycle ? (
                            <span className="mr-1.5 inline-flex size-5 items-center justify-center rounded bg-amber-200 text-[10px] font-bold text-amber-950 dark:bg-amber-800 dark:text-amber-50">
                              S{pos + 1}
                            </span>
                          ) : null}
                          {c.nameCours}
                        </label>
                        {inCycle ? (
                          <span className="flex shrink-0 gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={pos <= 0}
                              onClick={() => moveInCycle(c.id, -1)}
                              aria-label="Monter"
                            >
                              ↑
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={pos >= cycleCoursIds.length - 1}
                              onClick={() => moveInCycle(c.id, 1)}
                              aria-label="Descendre"
                            >
                              ↓
                            </Button>
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {cycleCoursIds.length > 1 ? (
                <p className="text-xs text-muted-foreground">
                  Rotation active :{" "}
                  {cycleCoursIds
                    .map((id, i) => {
                      const name =
                        domainCourses.find((c) => c.id === id)?.nameCours ??
                        id;
                      return `S${i + 1} ${name}`;
                    })
                    .join(" → ")}
                </p>
              ) : cycleCoursIds.length === 1 ? (
                <p className="text-xs text-muted-foreground">
                  1 cours sélectionné — créneau fixe (ajoutez un 2ᵉ cours pour
                  activer la rotation).
                </p>
              ) : null}
            </div>
          ) : null}

          <Button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="gap-1.5"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {editingId ? "Enregistrer" : "Créer le créneau"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
