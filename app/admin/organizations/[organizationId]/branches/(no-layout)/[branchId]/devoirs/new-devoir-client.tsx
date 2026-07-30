"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [pending, startTransition] = useTransition();
  const [teachings, setTeachings] = useState<TeachingOpt[]>([]);
  const [periods, setPeriods] = useState<Array<{ id: number; label: string }>>(
    [],
  );
  const [schoolYearId, setSchoolYearId] = useState("");
  const [teachingId, setTeachingId] = useState("");
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
        return;
      }
      setTeachings(opts.teachings);
      setPeriods(opts.periods);
      setSchoolYearId(opts.schoolYear.id);
      setFriday(opts.friday);
      if (opts.teachings[0]) setTeachingId(opts.teachings[0].id);
      if (opts.periods[0]) setPeriodId(String(opts.periods[0].id));
    });
  }, []);

  const submit = () => {
    const t = teachings.find((x) => x.id === teachingId);
    if (!t || !friday || !periodId || !title.trim()) {
      toast.error("Complétez le formulaire.");
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
      router.push(
        `/admin/organizations/${organizationId}/branches/${branchId}/devoirs/${res.id}`,
      );
    });
  };

  return (
    <DevoirsShell
      title="Nouveau devoir"
      listHref={`/admin/organizations/${organizationId}/branches/${branchId}/devoirs`}
      description="Créez un brouillon (dates vendredi → dimanche par défaut)."
      actions={
        <Button
          size="sm"
          type="button"
          disabled={pending}
          onClick={submit}
        >
          Créer le brouillon
        </Button>
      }
    >
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
            <Label>Cours / classe</Label>
            <Select value={teachingId} onValueChange={setTeachingId}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Affectation" />
              </SelectTrigger>
              <SelectContent>
                {teachings.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.courseName} — {t.className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button type="button" disabled={pending} onClick={submit}>
              Créer le brouillon
            </Button>
          </div>
        </CardContent>
      </Card>
    </DevoirsShell>
  );
}
