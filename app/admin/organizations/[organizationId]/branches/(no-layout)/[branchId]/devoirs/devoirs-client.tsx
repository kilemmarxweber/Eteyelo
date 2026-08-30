"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Copy,
  FileText,
  Filter,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
  createAssignmentAction,
  deleteAssignmentAction,
  duplicateAssignmentAction,
  getFormOptionsAction,
} from "@/lib/online-assignments/actions";
import { cn } from "@/lib/utils";

import { DevoirsShell } from "./devoirs-shell";

export type DevoirListItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  startAt: string;
  dueAt: string;
  totalPoints: number;
  resultsPublished: boolean;
  classId: string;
  className: string;
  courseId: string;
  courseName: string;
  schoolYearId: string;
  schoolYearName: string;
  questionsCount: number;
  submissionsCount: number;
  myStatus?: string | null;
  myScore?: number | null;
  canDelete?: boolean;
  isOpen?: boolean;
  isUpcoming?: boolean;
  learnerStatuses?: Array<{
    studentId: string;
    fullName: string;
    status: string;
    score: number | null;
  }>;
};

type FilterOptions = {
  schoolYears: Array<{ id: string; label: string; isCurrent: boolean }>;
  classes: Array<{ id: string; label: string }>;
  courses: Array<{ id: string; label: string }>;
  /** Paires affectation — cascade année → classe → cours pour les enseignants */
  teachings?: Array<{
    schoolYearId: string;
    classId: string;
    className: string;
    courseId: string;
    courseName: string;
  }>;
  scopedToTeacher?: boolean;
  scopeTeacherId?: string;
  defaultSchoolYearId: string;
};

type Props = {
  mode: "manage" | "student" | "parent";
  organizationId: string;
  branchId: string;
  assignments: DevoirListItem[];
  filterOptions: FilterOptions;
  students?: Array<{ id: string; fullName: string }>;
};

function statusBadge(status: string) {
  if (status === "PUBLISHED") {
    return (
      <span className="inline-flex h-5 items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
        Publié
      </span>
    );
  }
  if (status === "CLOSED") {
    return (
      <span className="inline-flex h-5 items-center rounded-md border border-slate-500/30 bg-slate-500/10 px-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-300">
        Fermé
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
      Brouillon
    </span>
  );
}

function learnerStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "SUBMITTED":
      return "Rendu";
    case "GRADED":
      return "Noté";
    case "DRAFT":
      return "En cours";
    case "UPCOMING":
      return "À venir";
    case "TODO":
      return "À faire";
    default:
      return status ? status : "À faire";
  }
}

function learnerTone(status: string | null | undefined) {
  const label = learnerStatusLabel(status);
  if (label === "Noté") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (label === "Rendu") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }
  if (label === "En cours") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  }
  if (label === "À venir") {
    return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  }
  return "border-border bg-muted/40 text-muted-foreground";
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CD", {
    day: "2-digit",
    month: "short",
  });
}

export function DevoirsClient({
  mode,
  organizationId,
  branchId,
  assignments,
  filterOptions,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const base = `/admin/organizations/${organizationId}/branches/${branchId}/devoirs`;

  const teachings = filterOptions.teachings ?? [];
  const scopedToTeacher = Boolean(filterOptions.scopedToTeacher);
  const scopeTeacherId = filterOptions.scopeTeacherId;

  const initialClassId = (() => {
    if (!scopedToTeacher || teachings.length === 0) return "all";
    const yearId = filterOptions.defaultSchoolYearId || "all";
    const inYear =
      yearId === "all"
        ? teachings
        : teachings.filter((t) => t.schoolYearId === yearId);
    const unique = [...new Set(inYear.map((t) => t.classId))];
    return unique.length === 1 ? unique[0]! : "all";
  })();

  const [schoolYearId, setSchoolYearId] = useState(
    filterOptions.defaultSchoolYearId || "all",
  );
  const [classId, setClassId] = useState(initialClassId);
  const [courseId, setCourseId] = useState("all");
  const [query, setQuery] = useState("");

  const classOptions = useMemo(() => {
    if (!scopedToTeacher || teachings.length === 0) {
      return filterOptions.classes;
    }
    const map = new Map<string, string>();
    for (const t of teachings) {
      if (schoolYearId !== "all" && t.schoolYearId !== schoolYearId) continue;
      map.set(t.classId, t.className);
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [scopedToTeacher, teachings, schoolYearId, filterOptions.classes]);

  const courseOptions = useMemo(() => {
    if (!scopedToTeacher || teachings.length === 0) {
      return filterOptions.courses;
    }
    const map = new Map<string, string>();
    for (const t of teachings) {
      if (schoolYearId !== "all" && t.schoolYearId !== schoolYearId) continue;
      if (classId !== "all" && t.classId !== classId) continue;
      map.set(t.courseId, t.courseName);
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [
    scopedToTeacher,
    teachings,
    schoolYearId,
    classId,
    filterOptions.courses,
  ]);

  const onSchoolYearChange = (value: string) => {
    setSchoolYearId(value);
    if (!scopedToTeacher) {
      setClassId("all");
      setCourseId("all");
      return;
    }
    const inYear =
      value === "all"
        ? teachings
        : teachings.filter((t) => t.schoolYearId === value);
    const uniqueClasses = [...new Set(inYear.map((t) => t.classId))];
    const nextClass =
      uniqueClasses.length === 1 ? uniqueClasses[0]! : "all";
    setClassId(nextClass);
    setCourseId("all");
  };

  const onClassChange = (value: string) => {
    setClassId(value);
    setCourseId("all");
  };

  // Évite une valeur de Select orpheline après cascade année → classe → cours
  useEffect(() => {
    if (classId !== "all" && !classOptions.some((c) => c.id === classId)) {
      setClassId("all");
      setCourseId("all");
      return;
    }
    if (courseId !== "all" && !courseOptions.some((c) => c.id === courseId)) {
      setCourseId("all");
    }
  }, [classId, courseId, classOptions, courseOptions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assignments.filter((a) => {
      if (schoolYearId !== "all" && a.schoolYearId !== schoolYearId) {
        return false;
      }
      if (classId !== "all" && a.classId !== classId) return false;
      if (courseId !== "all" && a.courseId !== courseId) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.courseName.toLowerCase().includes(q) ||
        a.className.toLowerCase().includes(q)
      );
    });
  }, [assignments, schoolYearId, classId, courseId, query]);

  const stats = useMemo(() => {
    const published = assignments.filter((a) => a.status === "PUBLISHED").length;
    const drafts = assignments.filter((a) => a.status === "DRAFT").length;
    const closed = assignments.filter((a) => a.status === "CLOSED").length;
    const openNow = assignments.filter((a) => a.isOpen).length;
    return { published, drafts, closed, openNow, total: assignments.length };
  }, [assignments]);

  const createFriday = () => {
    startTransition(async () => {
      const [opts, optsErr] = await getFormOptionsAction();
      if (optsErr || !opts) {
        toast.error(optsErr?.message ?? "Impossible de charger les options.");
        return;
      }
      const pool = scopeTeacherId
        ? opts.teachings.filter((t) => t.teacherId === scopeTeacherId)
        : opts.teachings;
      if (!pool.length) {
        toast.error("Aucune affectation cours/classe disponible.");
        return;
      }
      if (!opts.periods.length) {
        toast.error("Aucune période configurée.");
        return;
      }
      const preferred =
        pool.find(
          (t) =>
            (classId === "all" || t.classId === classId) &&
            (courseId === "all" || t.courseId === courseId),
        ) ?? pool[0];
      const [res, err] = await createAssignmentAction({
        title: `Devoir du vendredi — ${preferred.courseName}`,
        description: "Travail à faire pendant le weekend.",
        type: "DEVOIR",
        classId: preferred.classId,
        courseId: preferred.courseId,
        teachingId: preferred.id,
        teacherId: preferred.teacherId,
        periodId: opts.periods[0].id,
        schoolYearId: opts.schoolYear.id,
        startAt: opts.friday.startAt,
        dueAt: opts.friday.dueAt,
        activityDate: opts.friday.activityDate,
        fridayPreset: true,
        shuffleOptions: false,
        questions: [
          {
            type: "SHORT_TEXT",
            position: 0,
            statementHtml: "Réponds au devoir ci-dessous.",
            points: 10,
            options: [],
          },
        ],
      });
      if (err || !res) {
        toast.error(err?.message ?? "Création impossible.");
        return;
      }
      toast.success("Devoir créé (dates vendredi → dimanche).");
      router.push(`${base}/${res.id}`);
    });
  };

  const duplicate = (id: string) => {
    startTransition(async () => {
      const [res, err] = await duplicateAssignmentAction({ id });
      if (err || !res) {
        toast.error(err?.message ?? "Duplication impossible.");
        return;
      }
      toast.success("Copie créée.");
      router.push(`${base}/${res.id}`);
    });
  };

  const removeAssignment = (id: string) => {
    startTransition(async () => {
      const [, err] = await deleteAssignmentAction({ id });
      if (err) {
        toast.error(err.message);
        return;
      }
      toast.success("Devoir supprimé.");
      router.refresh();
    });
  };

  const resetFilters = () => {
    const year = filterOptions.defaultSchoolYearId || "all";
    setSchoolYearId(year);
    if (scopedToTeacher && teachings.length > 0) {
      const inYear =
        year === "all"
          ? teachings
          : teachings.filter((t) => t.schoolYearId === year);
      const unique = [...new Set(inYear.map((t) => t.classId))];
      setClassId(unique.length === 1 ? unique[0]! : "all");
    } else {
      setClassId("all");
    }
    setCourseId("all");
    setQuery("");
  };

  return (
    <DevoirsShell
      title="Devoirs"
      description={
        mode === "manage"
          ? scopedToTeacher
            ? "Uniquement vos classes et cours affectés — publiez pour le weekend."
            : "Filtrez par année, classe et cours — publiez pour le weekend."
          : mode === "parent"
            ? "Suivi des devoirs de vos enfants."
            : "Vos devoirs à faire pour le weekend."
      }
      actions={
        mode === "manage" ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                pending || (scopedToTeacher && teachings.length === 0)
              }
              onClick={createFriday}
              title={
                scopedToTeacher && teachings.length === 0
                  ? "Aucune affectation disponible"
                  : undefined
              }
            >
              <CalendarDays className="mr-1.5 size-3.5" />
              Vendredi
            </Button>
            <Button
              asChild
              size="sm"
              disabled={
                pending || (scopedToTeacher && teachings.length === 0)
              }
            >
              <Link
                href={`${base}/new${scopeTeacherId ? `?teacherId=${scopeTeacherId}` : ""}`}
                aria-disabled={scopedToTeacher && teachings.length === 0}
                className={
                  scopedToTeacher && teachings.length === 0
                    ? "pointer-events-none opacity-50"
                    : undefined
                }
              >
                <Plus className="mr-1.5 size-3.5" />
                Nouveau
              </Link>
            </Button>
          </>
        ) : undefined
      }
    >
      {/* Synthèse */}
      <section className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.09] via-card to-card shadow-sm dark:from-primary/[0.12]">
        <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4 sm:p-3.5">
          <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 backdrop-blur-sm">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <FileText className="size-3.5" />
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Total
              </p>
              <p className="text-sm font-semibold tabular-nums">{stats.total}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 backdrop-blur-sm">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <BookOpen className="size-3.5" />
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Publiés
              </p>
              <p className="text-sm font-semibold tabular-nums">
                {stats.published}
                {mode !== "manage" && stats.openNow > 0
                  ? ` · ${stats.openNow} ouverts`
                  : ""}
              </p>
            </div>
          </div>
          {mode === "manage" ? (
            <>
              <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 backdrop-blur-sm">
                <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300">
                  <FileText className="size-3.5" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Brouillons
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {stats.drafts}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 backdrop-blur-sm">
                <div className="flex size-8 items-center justify-center rounded-lg bg-slate-500/15 text-slate-700 dark:text-slate-300">
                  <Users className="size-3.5" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Clôturés
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {stats.closed}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 backdrop-blur-sm sm:col-span-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300">
                  <CalendarDays className="size-3.5" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Affichés
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {filtered.length} / {assignments.length}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Filtres */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-primary/[0.07] to-transparent px-3 py-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Filter className="size-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground">Filtres</p>
            <p className="text-[11px] text-muted-foreground">
              {scopedToTeacher
                ? "Classe puis cours que vous enseignez"
                : `${filtered.length} résultat${filtered.length > 1 ? "s" : ""} sur ${assignments.length}`}
              {scopedToTeacher
                ? ` · ${filtered.length} / ${assignments.length}`
                : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={resetFilters}
          >
            Réinitialiser
          </Button>
        </div>
        <div className="grid gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              Année scolaire
            </Label>
            <Select value={schoolYearId} onValueChange={onSchoolYearChange}>
              <SelectTrigger className="h-8 bg-background text-xs">
                <SelectValue placeholder="Année" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les années</SelectItem>
                {filterOptions.schoolYears.map((y) => (
                  <SelectItem key={y.id} value={y.id}>
                    {y.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Classe</Label>
            <Select
              value={classId}
              onValueChange={onClassChange}
              disabled={scopedToTeacher && classOptions.length === 0}
            >
              <SelectTrigger className="h-8 bg-background text-xs">
                <SelectValue
                  placeholder={
                    scopedToTeacher && classOptions.length === 0
                      ? "Aucune classe affectée"
                      : "Classe"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {scopedToTeacher
                    ? "Toutes mes classes"
                    : "Toutes les classes"}
                </SelectItem>
                {classOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Cours</Label>
            <Select
              value={courseId}
              onValueChange={setCourseId}
              disabled={
                scopedToTeacher &&
                (classId === "all"
                  ? courseOptions.length === 0
                  : courseOptions.length === 0)
              }
            >
              <SelectTrigger className="h-8 bg-background text-xs">
                <SelectValue
                  placeholder={
                    scopedToTeacher && classId !== "all" && courseOptions.length === 0
                      ? "Aucun cours dans cette classe"
                      : "Cours"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {scopedToTeacher
                    ? classId === "all"
                      ? "Tous mes cours"
                      : "Tous mes cours de la classe"
                    : "Tous les cours"}
                </SelectItem>
                {courseOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Recherche</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Titre, cours…"
                className="h-8 bg-background pl-7 text-xs"
              />
            </div>
          </div>
        </div>
      </section>

      {mode === "manage" &&
      scopedToTeacher &&
      teachings.length === 0 ? (
        <EmptyState
          title="Aucune affectation"
          description="Vous n’êtes affecté à aucune classe ou cours. Contactez l’administration pour recevoir une affectation avant de créer des devoirs."
        />
      ) : assignments.length === 0 ? (
        <EmptyState
          title="Aucun devoir"
          description={
            mode === "manage"
              ? scopedToTeacher
                ? "Créez un devoir pour l’une de vos classes afin de démarrer."
                : "Créez un devoir du vendredi pour démarrer."
              : "Aucun devoir publié pour le moment."
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucun résultat"
          description="Modifiez les filtres (année, classe, cours) pour afficher des devoirs."
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={resetFilters}
            >
              Réinitialiser
            </Button>
          }
        />
      ) : (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Liste
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {filtered.length} devoir{filtered.length > 1 ? "s" : ""}
            </span>
          </div>

          <ul className="space-y-2.5">
            {filtered.map((a) => (
              <li key={a.id}>
                <article
                  className={cn(
                    "group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all",
                    "hover:border-primary/25 hover:shadow-md",
                  )}
                >
                  <div className="flex gap-0">
                    <div className="flex w-10 shrink-0 flex-col items-center justify-center gap-1 bg-gradient-to-b from-primary/15 to-primary/5 py-3 dark:from-primary/20 dark:to-primary/5">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                        {a.type === "EVALUATION" ? (
                          <BookOpen className="size-3.5" />
                        ) : (
                          <FileText className="size-3.5" />
                        )}
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`${base}/${a.id}`}
                            className="truncate text-sm font-semibold text-foreground hover:text-primary hover:underline"
                          >
                            {a.title}
                          </Link>
                          {statusBadge(a.status)}
                          <Badge
                            variant="outline"
                            className="h-5 border-primary/20 bg-primary/5 px-1.5 text-[10px] font-normal text-primary"
                          >
                            {a.type === "EVALUATION" ? "Éval." : "Devoir"}
                          </Badge>
                          {mode !== "manage" && a.myStatus ? (
                            <span
                              className={cn(
                                "inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-medium",
                                learnerTone(a.myStatus),
                              )}
                            >
                              {learnerStatusLabel(a.myStatus)}
                            </span>
                          ) : null}
                          {mode !== "manage" && a.isUpcoming ? (
                            <span className="inline-flex h-5 items-center rounded-md border border-slate-500/30 bg-slate-500/10 px-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-300">
                              Ouvre {formatShortDate(a.startAt)}
                            </span>
                          ) : null}
                          {mode !== "manage" && a.isOpen ? (
                            <span className="inline-flex h-5 items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                              Ouvert
                            </span>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5 text-foreground/85">
                            <BookOpen className="size-3 text-primary" />
                            {a.courseName}
                          </span>
                          <span className="rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5">
                            {a.className}
                          </span>
                          {a.schoolYearName ? (
                            <span className="rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5">
                              {a.schoolYearName}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5 tabular-nums">
                            <CalendarDays className="size-3" />
                            {formatShortDate(a.startAt)} →{" "}
                            {formatShortDate(a.dueAt)}
                          </span>
                          <span className="rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5">
                            {a.questionsCount} q.
                          </span>
                          {mode === "manage" ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5">
                              <Users className="size-3" />
                              {a.submissionsCount} copie
                              {a.submissionsCount > 1 ? "s" : ""}
                            </span>
                          ) : a.myScore != null ? (
                            <span className="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                              {a.myScore}/{a.totalPoints}
                            </span>
                          ) : a.resultsPublished ? (
                            <span className="rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5">
                              Note publiée
                            </span>
                          ) : null}
                        </div>

                        {mode === "parent" &&
                        a.learnerStatuses &&
                        a.learnerStatuses.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {a.learnerStatuses.map((ls) => (
                              <span
                                key={ls.studentId}
                                className={cn(
                                  "inline-flex max-w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                                  learnerTone(ls.status),
                                )}
                              >
                                <span className="truncate">{ls.fullName}</span>
                                <span className="opacity-70">
                                  {learnerStatusLabel(ls.status)}
                                  {ls.score != null
                                    ? ` ${ls.score}/${a.totalPoints}`
                                    : ""}
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          asChild
                          size="sm"
                          variant="secondary"
                          className="h-8 gap-1 px-2.5 text-xs"
                        >
                          <Link href={`${base}/${a.id}`}>
                            Ouvrir
                            <ChevronRight className="size-3.5 opacity-70" />
                          </Link>
                        </Button>
                        {mode === "manage" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            disabled={pending}
                            onClick={() => duplicate(a.id)}
                            title="Dupliquer"
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        ) : null}
                        {mode === "manage" && a.canDelete ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                                disabled={pending}
                                title="Supprimer"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-background">
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Supprimer ce devoir ?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  « {a.title} » sera définitivement supprimé
                                  {a.status === "DRAFT"
                                    ? " (brouillon)."
                                    : " (non encore corrigé)."}{" "}
                                  Les questions et copies associées seront
                                  effacées.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => removeAssignment(a.id)}
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}
    </DevoirsShell>
  );
}
