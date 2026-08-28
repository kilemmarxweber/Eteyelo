"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, FileText, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LevelSectionOptionFields } from "@/components/level-section-option-fields";
import { isPrimaryBranch } from "@/lib/class-structure";
import { uploadDocument } from "@/lib/upload-file";
import { useAppTransition } from "@/hooks/use-app-transition";
import { completeTeacherApplicationAction } from "./teacher-application.action";

export function TeacherApplicationCompleteForm({
  teacherId,
  branchType,
  teacherLabelLower,
  needsBirthDate,
  assignmentYearCount,
  assignmentYearLabels,
}: {
  teacherId: string;
  branchType: string;
  teacherLabelLower: string;
  needsBirthDate: boolean;
  assignmentYearCount: number;
  assignmentYearLabels: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useAppTransition();
  const [desiredSubjects, setDesiredSubjects] = useState("");
  const [desiredLevels, setDesiredLevels] = useState("");
  const [desiredSection, setDesiredSection] = useState("");
  const [desiredOption, setDesiredOption] = useState("");
  const [educationSummary, setEducationSummary] = useState("");
  const [skills, setSkills] = useState("");
  const [experienceSummary, setExperienceSummary] = useState("");
  const [motivation, setMotivation] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null);

  function submit() {
    if (!desiredSubjects.trim() || !desiredLevels.trim()) {
      toast.error("Indiquez les matières et le niveau.");
      return;
    }
    if (
      !isPrimaryBranch(branchType) &&
      branchType !== "MATERNELLE" &&
      (!desiredSection.trim() || !desiredOption.trim())
    ) {
      toast.error("Choisissez la section et l'option.");
      return;
    }
    if (needsBirthDate && !dateOfBirth) {
      toast.error("Indiquez la date de naissance.");
      return;
    }
    if (!cvFile || !coverLetterFile) {
      toast.error("Le CV et la lettre de motivation sont obligatoires.");
      return;
    }

    startTransition(async () => {
      try {
        const uploadedCv = await uploadDocument(cvFile);
        if (!uploadedCv.ok) {
          toast.error(uploadedCv.message);
          return;
        }
        const uploadedCover = await uploadDocument(coverLetterFile);
        if (!uploadedCover.ok) {
          toast.error(uploadedCover.message);
          return;
        }

        const levelsLabel = [desiredLevels, desiredSection, desiredOption]
          .filter(Boolean)
          .join(" · ");

        const [, err] = await completeTeacherApplicationAction({
          teacherId,
          desiredSubjects: desiredSubjects.trim(),
          desiredLevels: levelsLabel || desiredLevels.trim(),
          educationSummary: educationSummary.trim() || undefined,
          skills: skills.trim() || undefined,
          experienceSummary: experienceSummary.trim() || undefined,
          motivation: motivation.trim() || undefined,
          dateOfBirth: needsBirthDate ? dateOfBirth : undefined,
          cvUrl: uploadedCv.url,
          coverLetterUrl: uploadedCover.url,
        });

        if (err) {
          toast.error(err.message || "Impossible d'enregistrer le dossier.");
          return;
        }

        toast.success("Dossier complété.");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Impossible d'enregistrer le dossier.",
        );
      }
    });
  }

  return (
    <Card className="overflow-hidden rounded-xl border-violet-200/80 bg-gradient-to-b from-violet-500/[0.07] via-card to-card p-0 shadow-sm dark:border-violet-900/40">
      <div className="border-b border-violet-500/10 bg-violet-500/[0.06] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
            <Briefcase className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Compléter le dossier</h3>
            <p className="text-xs text-muted-foreground">
              Aucune candidature en ligne. Ajoutez l’expérience et les pièces du{" "}
              {teacherLabelLower} (identité déjà connue).
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="teacher-subjects">Matières *</Label>
            <Input
              id="teacher-subjects"
              value={desiredSubjects}
              onChange={(event) => setDesiredSubjects(event.target.value)}
              placeholder="Mathématiques, Français…"
            />
          </div>

          <div className="md:col-span-2">
            <LevelSectionOptionFields
              typebranch={branchType}
              multiLevel
              value={{
                level: desiredLevels,
                sectionName: desiredSection,
                optionName: desiredOption,
              }}
              onChange={(next) => {
                setDesiredLevels(next.level);
                setDesiredSection(next.sectionName);
                setDesiredOption(next.optionName);
              }}
            />
          </div>

          <div className="rounded-lg border border-violet-500/15 bg-violet-500/[0.06] px-3 py-2.5 md:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700/85 dark:text-violet-400">
              Années d&apos;expérience
            </p>
            <p className="mt-0.5 text-sm font-medium">
              {assignmentYearCount} an{assignmentYearCount > 1 ? "s" : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Calculé automatiquement selon les années d&apos;affectation en
              classe
              {assignmentYearLabels.length
                ? ` (${assignmentYearLabels.join(", ")})`
                : " — aucune affectation pour le moment"}
              . Le dossier évolue à chaque nouvelle année scolaire.
            </p>
          </div>
          <div className="md:col-span-2 rounded-md border border-dashed bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Disponibilité</p>
            <p className="mt-1 text-xs leading-relaxed">
              Calculée automatiquement : <strong>Actif</strong> si le compte est
              engagé et affecté à l&apos;année en cours,{" "}
              <strong>Renvoyé</strong> si le compte est inactif, sinon{" "}
              <strong>N&apos;est plus actif</strong>.
            </p>
          </div>

          {needsBirthDate ? (
            <div className="space-y-1.5">
              <Label htmlFor="teacher-birth">Date de naissance *</Label>
              <Input
                id="teacher-birth"
                type="date"
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
              />
            </div>
          ) : null}

          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="teacher-education">Formation / diplômes</Label>
            <Textarea
              id="teacher-education"
              rows={3}
              value={educationSummary}
              onChange={(event) => setEducationSummary(event.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="teacher-skills">Compétences</Label>
            <Textarea
              id="teacher-skills"
              rows={3}
              value={skills}
              onChange={(event) => setSkills(event.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="teacher-experience">Résumé d&apos;expérience</Label>
            <Textarea
              id="teacher-experience"
              rows={4}
              value={experienceSummary}
              onChange={(event) => setExperienceSummary(event.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="teacher-motivation">Motivation</Label>
            <Textarea
              id="teacher-motivation"
              rows={4}
              value={motivation}
              onChange={(event) => setMotivation(event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4">
            <FileText className="size-5 text-primary" />
            <span className="min-w-0 text-sm">
              {cvFile ? cvFile.name : "CV * (PDF, DOC, DOCX)"}
            </span>
            <Upload className="ml-auto size-4 shrink-0 text-muted-foreground" />
            <Input
              className="hidden"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => setCvFile(event.target.files?.[0] ?? null)}
            />
          </Label>
          <Label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4">
            <FileText className="size-5 text-primary" />
            <span className="min-w-0 text-sm">
              {coverLetterFile
                ? coverLetterFile.name
                : "Lettre de motivation * (PDF, DOC, DOCX)"}
            </span>
            <Upload className="ml-auto size-4 shrink-0 text-muted-foreground" />
            <Input
              className="hidden"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) =>
                setCoverLetterFile(event.target.files?.[0] ?? null)
              }
            />
          </Label>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={() => void submit()} disabled={isPending}>
            {isPending ? "Enregistrement…" : "Enregistrer le dossier"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
