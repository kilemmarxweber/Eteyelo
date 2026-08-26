"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
  createAssignmentAction,
  getFormOptionsAction,
} from "@/lib/online-assignments/actions";

import { DevoirsShell } from "./devoirs-shell";

type TeachingOpt = {
  id: string;
  classId: string;
  className: string;
  courseId: string;
  courseName: string;
  teacherId: string;
};

type Props = {
  organizationId: string;
  branchId: string;
};

export function NewDevoirClient({ organizationId, branchId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scopedTeacherId = searchParams.get("teacherId");
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [teachings, setTeachings] = useState<TeachingOpt[]>([]);
  const [periods, setPeriods] = useState<Array<{ id: number; label: string }>>(
    [],
  );
  const [schoolYearId, setSchoolYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"DEVOIR" | "EVALUATION">("DEVOIR");
  const [useFriday, setUseFriday] = useState(true);
  const [friday, setFriday] = useState<{
    startAt: Date;
    dueAt: Date;
    activityDate: Date;
  } | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const [opts, err] = await getFormOptionsAction();
      if (err || !opts) {
        toast.error(err?.message ?? "Chargement impossible.");
        setLoaded(true);
        return;
      }
      setTeachings(
        scopedTeacherId
          ? opts.teachings.filter((t) => t.teacherId === scopedTeacherId)
          : opts.teachings,
      );
      setPeriods(opts.periods);
      setSchoolYearId(opts.schoolYear.id);
      setFriday(opts.friday);
      if (opts.periods[0]) setPeriodId(String(opts.periods[0].id));

      const classIds = [...new Set(opts.teachings.map((t) => t.classId))];
      const nextClass =
        classIds.length === 1 ? classIds[0]! : (opts.teachings[0]?.classId ?? "");
      setClassId(nextClass);
      const coursesInClass = opts.teachings.filter((t) => t.classId === nextClass);
      const nextCourse =
        coursesInClass.length === 1
          ? coursesInClass[0]!.courseId
          : (coursesInClass[0]?.courseId ?? "");
      setCourseId(nextCourse);
      setLoaded(true);
    });
  }, [scopedTeacherId]);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teachings) {
      map.set(t.classId, t.className);
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [teachings]);

  const courseOptions = useMemo(() => {
    return teachings
      .filter((t) => t.classId === classId)
      .map((t) => ({
        id: t.courseId,
        label: t.courseName,
        teachingId: t.id,
        teacherId: t.teacherId,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [teachings, classId]);

  const selectedTeaching = useMemo(() => {
    return teachings.find(
      (t) => t.classId === classId && t.courseId === courseId,
    );
  }, [teachings, classId, courseId]);

  const onClassChange = (value: string) => {
    setClassId(value);
    const next = teachings.filter((t) => t.classId === value);
    setCourseId(
      next.length === 1 ? next[0]!.courseId : (next[0]?.courseId ?? ""),
    );
  };

  const listHref = `/admin/organizations/${organizationId}/branches/${branchId}/devoirs${
    scopedTeacherId ? `?teacherId=${scopedTeacherId}` : ""
  }`;

  const submit = () => {
    const t = selectedTeaching;
    if (!t || !friday || !periodId || !title.trim()) {
      toast.error(
        !t
          ? "Choisissez une classe et un cours que vous enseignez."
          : "Complétez le formulaire.",
      );
      return;
    }
    startTransition(async () => {
      const [res, err] = await createAssignmentAction({
        title: title.trim(),
        description: description.trim() || null,
        type,
        classId: t.classId,
        courseId: t.courseId,
        teachingId: t.id,
        teacherId: t.teacherId,
        periodId: Number(periodId),
        schoolYearId,
        startAt: friday.startAt,
        dueAt: friday.dueAt,
        activityDate: friday.activityDate,
        fridayPreset: useFriday,
        shuffleOptions: false,
        questions: [
          {
            type: "LONG_TEXT",
            position: 0,
            statementHtml: "Consigne / réponse longue",
            points: 10,
            options: [],
          },
        ],
      });
      if (err || !res) {
        toast.error(err?.message ?? "Création impossible.");
        return;
      }
      toast.success("Brouillon créé.");
      router.push(`${listHref}/${res.id}`);
    });
  };

  const noTeachings = loaded && teachings.length === 0;

  return (
    <DevoirsShell
      title="Nouveau devoir"
      listHref={listHref}
      description="Choisissez d’abord la classe, puis le cours que vous enseignez."
      actions={
        noTeachings ? undefined : (
          <Button
            size="sm"
            type="button"
            disabled={pending || !selectedTeaching}
            onClick={submit}
          >
            Créer le brouillon
          </Button>
        )
      }
    >
      {noTeachings ? (
        <EmptyState
          title="Aucune affectation"
          description="Vous n’êtes affecté à aucune classe ou cours pour l’année en cours. Contactez l’administration."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href={listHref}>Retour aux devoirs</Link>
            </Button>
          }
        />
      ) : (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Informations</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-background"
                placeholder="Ex. Devoir Français — weekend"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as "DEVOIR" | "EVALUATION")}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEVOIR">Devoir</SelectItem>
                  <SelectItem value="EVALUATION">Évaluation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Classe</Label>
              <Select
                value={classId}
                onValueChange={onClassChange}
                disabled={!classOptions.length}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Votre classe" />
                </SelectTrigger>
                <SelectContent>
                  {classOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cours</Label>
              <Select
                value={courseId}
                onValueChange={setCourseId}
                disabled={!classId || courseOptions.length === 0}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue
                    placeholder={
                      !classId
                        ? "Choisissez d’abord une classe"
                        : "Cours que vous enseignez"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {courseOptions.map((c) => (
                    <SelectItem key={c.teachingId} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {classId && courseOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucun cours affecté dans cette classe.
                </p>
              ) : null}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="desc">Consignes</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-24 bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label>Période</Label>
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground md:col-span-2">
              <input
                type="checkbox"
                checked={useFriday}
                onChange={(e) => setUseFriday(e.target.checked)}
                className="size-4 rounded border-border"
              />
              Préremplir dates « Devoir du vendredi » (ven. 16h → dim. 23:59)
            </label>
            <div className="md:col-span-2">
              <Button
                type="button"
                disabled={pending || !selectedTeaching}
                onClick={submit}
              >
                Créer le brouillon
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </DevoirsShell>
  );
}
