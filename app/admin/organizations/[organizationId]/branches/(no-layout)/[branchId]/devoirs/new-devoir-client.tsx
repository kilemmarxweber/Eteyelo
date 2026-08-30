"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Save, Send } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import {
  createAssignmentAction,
  getFormOptionsAction,
  publishAssignmentAction,
} from "@/lib/online-assignments/actions";

import {
  QuestionEditor,
  type QuestionEditorHandle,
} from "./[id]/question-editor";
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
  const editorRef = useRef<QuestionEditorHandle>(null);
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

  const validateMeta = (): string | null => {
    if (!title.trim() || title.trim().length < 2) {
      return "Le titre est obligatoire (2 caractères min.).";
    }
    if (!selectedTeaching) {
      return "Choisissez une classe et un cours que vous enseignez.";
    }
    if (!periodId) return "Choisissez une période.";
    if (!friday) return "Dates indisponibles — rechargez la page.";
    return null;
  };

  const create = (andPublish: boolean) => {
    const metaError = validateMeta();
    if (metaError) {
      toast.error(metaError);
      return;
    }
    const questions = editorRef.current?.getValidatedPayload();
    if (!questions) return;

    const t = selectedTeaching!;
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
        startAt: friday!.startAt,
        dueAt: friday!.dueAt,
        activityDate: friday!.activityDate,
        fridayPreset: useFriday,
        shuffleOptions: false,
        questions,
      });
      if (err || !res) {
        toast.error(err?.message ?? "Création impossible.");
        return;
      }

      if (andPublish) {
        const [, pubErr] = await publishAssignmentAction({ id: res.id });
        if (pubErr) {
          toast.error(
            pubErr.message ??
              "Créé mais non publié — ouvrez le devoir pour publier.",
          );
          router.push(`${listHref}/${res.id}`);
          return;
        }
        toast.success("Devoir créé et publié.");
      } else {
        toast.success("Devoir enregistré.");
      }
      router.push(`${listHref}/${res.id}`);
    });
  };

  const noTeachings = loaded && teachings.length === 0;

  return (
    <DevoirsShell
      title="Nouveau devoir"
      listHref={listHref}
      description="Remplissez les informations nécessaires et les questions. Enregistrez ou publiez quand vous êtes prêt."
      actions={
        noTeachings ? undefined : (
          <>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={pending || !selectedTeaching}
              onClick={() => create(false)}
            >
              <Save className="mr-1.5 size-3.5" />
              Enregistrer
            </Button>
            <Button
              size="sm"
              type="button"
              disabled={pending || !selectedTeaching}
              onClick={() => create(true)}
            >
              <Send className="mr-1.5 size-3.5" />
              Publier
            </Button>
          </>
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
        <div className="space-y-4">
          <section className="space-y-3 rounded-xl border border-border bg-card p-3 sm:p-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Informations nécessaires
              </h2>
              <p className="text-xs text-muted-foreground">
                Titre, classe, cours et période sont obligatoires. Les dates
                peuvent être préremplies pour le weekend.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">
                  Titre <span className="text-destructive">*</span>
                </Label>
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
                <Label>
                  Classe <span className="text-destructive">*</span>
                </Label>
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
                <Label>
                  Cours <span className="text-destructive">*</span>
                </Label>
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
                <Label htmlFor="desc">Consignes (optionnel)</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-20 bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Période <span className="text-destructive">*</span>
                </Label>
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
                Dates « Devoir du vendredi » (ven. 16h → dim. 23:59)
              </label>
            </div>
          </section>

          <QuestionEditor
            ref={editorRef}
            hideFooter
            headerHint="Ajoutez au moins une question. Vous pourrez encore modifier après enregistrement tant que le devoir n’est pas publié."
          />

          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-card/95 px-3 py-2.5 shadow-md backdrop-blur supports-[backdrop-filter]:bg-card/90">
            <p className="hidden text-xs text-muted-foreground sm:block">
              Enregistrer pour continuer plus tard, ou Publier pour le rendre
              visible aux élèves.
            </p>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !selectedTeaching}
                onClick={() => create(false)}
              >
                <Save className="mr-2 size-4" />
                Enregistrer
              </Button>
              <Button
                type="button"
                disabled={pending || !selectedTeaching}
                onClick={() => create(true)}
              >
                <Send className="mr-2 size-4" />
                Publier
              </Button>
            </div>
          </div>
        </div>
      )}
    </DevoirsShell>
  );
}
