"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  ListChecks,
  Send,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  exportResultsCsvAction,
  gradeAnswerAction,
  publishAssignmentAction,
  publishResultsAction,
  saveAnswersAction,
  submitAssignmentAction,
} from "@/lib/online-assignments/actions";
import { cn } from "@/lib/utils";

import { DevoirsShell } from "../devoirs-shell";
import {
  QuestionEditor,
  questionsFromServer,
} from "./question-editor";
import { FormulaPreview } from "./formula-preview";
import { FormulaToolbar } from "./formula-toolbar";

function optionLetter(index: number) {
  return String.fromCharCode(65 + index);
}

function statusTone(status: string) {
  if (status === "GRADED" || status === "Noté") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "SUBMITTED" || status === "Rendu") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }
  if (status === "DRAFT" || status === "En cours") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  }
  if (status === "UPCOMING" || status === "À venir") {
    return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  }
  return "border-border bg-muted/50 text-muted-foreground";
}

type Question = {
  id: string;
  type: string;
  position: number;
  statementHtml: string;
  points: number;
  options: Array<{ id: string; label: string; isCorrect?: boolean }>;
  correctAnswerJson?: unknown;
  settingsJson?: unknown;
};

type Props = {
  mode: "manage" | "student" | "parent";
  organizationId: string;
  branchId: string;
  assignment: {
    id: string;
    title: string;
    description: string | null;
    type: string;
    status: string;
    startAt: string;
    dueAt: string;
    totalPoints: number;
    resultsPublished: boolean;
    shuffleOptions: boolean;
    className: string;
    courseName: string;
    questions: Question[];
    fiche?: { id: string; status: boolean; typeFiche: string } | null;
  };
  submission?: {
    id: string;
    status: string;
    provisionalScore: number | null;
    finalScore: number | null;
    answers: Array<{
      questionId: string;
      answerText: string | null;
      answerJson: unknown;
      awardedPoints: number | null;
      needsManual: boolean;
      teacherFeedback: string | null;
    }>;
  } | null;
  submissions?: Array<{
    id: string;
    studentName: string;
    status: string;
    provisionalScore: number | null;
    finalScore: number | null;
    answers: Array<{
      questionId: string;
      answerText: string | null;
      awardedPoints: number | null;
      needsManual: boolean;
    }>;
  }>;
};

export function DevoirDetailClient({
  mode,
  organizationId,
  branchId,
  assignment,
  submission,
  submissions = [],
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const base = `/admin/organizations/${organizationId}/branches/${branchId}/devoirs`;

  const initialAnswers = useMemo(() => {
    const map: Record<string, { text: string; optionIds: string[] }> = {};
    for (const q of assignment.questions) {
      const ans = submission?.answers.find((a) => a.questionId === q.id);
      const json = (ans?.answerJson ?? {}) as {
        optionId?: string;
        optionIds?: string[];
      };
      map[q.id] = {
        text: ans?.answerText ?? "",
        optionIds: json.optionIds ?? (json.optionId ? [json.optionId] : []),
      };
    }
    return map;
  }, [assignment.questions, submission]);

  const [answers, setAnswers] = useState(initialAnswers);
  const locked =
    submission?.status === "SUBMITTED" || submission?.status === "GRADED";
  const now = Date.now();
  const startMs = new Date(assignment.startAt).getTime();
  const dueMs = new Date(assignment.dueAt).getTime();
  const notYetOpen = now < startMs;
  const pastDue = now > dueMs;
  const canAnswer =
    mode === "student" &&
    assignment.status === "PUBLISHED" &&
    !locked &&
    !notYetOpen &&
    !pastDue;

  const buildPayload = () =>
    assignment.questions.map((q) => ({
      questionId: q.id,
      answerText: answers[q.id]?.text || null,
      answerJson:
        q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE"
          ? { optionId: answers[q.id]?.optionIds[0] ?? null }
          : q.type === "MULTIPLE_CHOICE"
            ? { optionIds: answers[q.id]?.optionIds ?? [] }
            : null,
    }));

  const autosave = () => {
    if (mode !== "student" || locked) return;
    startTransition(async () => {
      const [, err] = await saveAnswersAction({
        assignmentId: assignment.id,
        answers: buildPayload(),
      });
      if (err) toast.error(err.message);
      else toast.success("Brouillon enregistré");
    });
  };

  const submit = () => {
    startTransition(async () => {
      const [res, err] = await submitAssignmentAction({
        id: assignment.id,
        answers: buildPayload(),
      });
      if (err || !res) {
        toast.error(err?.message ?? "Soumission impossible.");
        return;
      }
      toast.success(
        res.pendingManual
          ? `Soumis. Note provisoire ${res.provisionalScore} (correction manuelle en attente).`
          : `Soumis et noté : ${res.provisionalScore}`,
      );
      router.refresh();
    });
  };

  const publish = () => {
    startTransition(async () => {
      const [, err] = await publishAssignmentAction({ id: assignment.id });
      if (err) toast.error(err.message);
      else {
        toast.success("Devoir publié.");
        router.refresh();
      }
    });
  };

  const publishResults = () => {
    startTransition(async () => {
      const [res, err] = await publishResultsAction({
        id: assignment.id,
        publish: true,
      });
      if (err || !res) toast.error(err?.message ?? "Erreur");
      else {
        toast.success(
          `Résultats publiés. Fiche créée/màj (${res.ficheId.slice(0, 8)}…) status=false.`,
        );
        router.refresh();
      }
    });
  };

  const exportCsv = () => {
    startTransition(async () => {
      const [res, err] = await exportResultsCsvAction({ id: assignment.id });
      if (err || !res) {
        toast.error(err?.message ?? "Export impossible");
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const isDraftEditor = mode === "manage" && assignment.status === "DRAFT";

  const formatRange = () => {
    const opts: Intl.DateTimeFormatOptions = {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    };
    return `${new Date(assignment.startAt).toLocaleString("fr-CD", opts)} → ${new Date(assignment.dueAt).toLocaleString("fr-CD", opts)}`;
  };

  const studentStatusLabel = locked
    ? submission?.status === "GRADED"
      ? "Noté"
      : "Rendu"
    : notYetOpen
      ? "À venir"
      : pastDue || assignment.status === "CLOSED"
        ? "Clôturé"
        : submission?.status === "DRAFT"
          ? "En cours"
          : "À faire";

  const studentScore =
    assignment.resultsPublished &&
    (submission?.finalScore != null || submission?.provisionalScore != null)
      ? `${submission?.finalScore ?? submission?.provisionalScore}/${assignment.totalPoints}`
      : null;

  return (
    <DevoirsShell
      title={assignment.title}
      listHref={base}
      description={`${assignment.courseName} · ${assignment.className} · ${
        assignment.type === "EVALUATION" ? "Évaluation" : "Devoir"
      }`}
      badge={
        <Badge variant="outline" className="h-5 border-border px-1.5 text-[10px]">
          {assignment.status}
        </Badge>
      }
      actions={
        mode === "manage" ? (
          <>
            {assignment.status === "DRAFT" ? (
              <Button size="sm" disabled={pending} onClick={publish}>
                Publier
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={publishResults}
            >
              Publier résultats
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={exportCsv}
            >
              CSV
            </Button>
          </>
        ) : undefined
      }
    >
      {/* Hero méta */}
      <section className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.09] via-card to-card shadow-sm dark:from-primary/[0.12]">
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-stretch sm:gap-4 sm:p-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 backdrop-blur-sm">
                <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Fenêtre
                  </p>
                  <p className="truncate text-xs font-medium tabular-nums text-foreground">
                    {formatRange()}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 backdrop-blur-sm">
                <Target className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Barème
                  </p>
                  <p className="text-xs font-medium text-foreground">
                    {assignment.totalPoints} points
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 backdrop-blur-sm">
                <ListChecks className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Questions
                  </p>
                  <p className="text-xs font-medium text-foreground">
                    {assignment.questions.length} énoncé
                    {assignment.questions.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>

            {(mode === "student" ||
              (mode === "manage" && assignment.fiche) ||
              (mode === "parent" && assignment.resultsPublished) ||
              assignment.description) && (
              <div className="flex flex-wrap items-center gap-2">
                {mode === "student" ? (
                  <>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
                        statusTone(studentStatusLabel),
                      )}
                    >
                      {studentStatusLabel}
                    </span>
                    {studentScore ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        <CheckCircle2 className="size-3" />
                        {studentScore}
                      </span>
                    ) : null}
                  </>
                ) : null}
                {mode === "manage" && assignment.fiche ? (
                  <span className="inline-flex items-center rounded-md border border-border bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground">
                    Fiche {assignment.fiche.typeFiche}
                    {!assignment.fiche.status ? " · intermédiaire" : ""}
                  </span>
                ) : null}
                {mode === "parent" && assignment.resultsPublished ? (
                  <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    Résultats publiés
                  </span>
                ) : null}
              </div>
            )}

            {assignment.description ? (
              <p className="line-clamp-3 border-t border-border/60 pt-2 text-xs leading-relaxed text-foreground/85">
                {assignment.description}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {isDraftEditor ? (
        <QuestionEditor
          key={assignment.questions
            .map((q) => `${q.id}:${q.points}:${q.statementHtml.length}`)
            .join("|")}
          assignmentId={assignment.id}
          initialQuestions={questionsFromServer(assignment.questions)}
          onSaved={() => router.refresh()}
        />
      ) : (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Énoncés
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {assignment.questions.length} / {assignment.totalPoints} pts
            </span>
          </div>

          <div className="space-y-2.5">
            {assignment.questions.map((q, idx) => (
              <article
                key={q.id}
                className={cn(
                  "group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow",
                  "hover:border-primary/25 hover:shadow-md",
                )}
              >
                <div className="flex gap-0">
                  <div className="flex w-10 shrink-0 flex-col items-center gap-1 bg-gradient-to-b from-primary/15 to-primary/5 py-3 dark:from-primary/20 dark:to-primary/5">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-[11px] font-bold text-primary-foreground shadow-sm">
                      {idx + 1}
                    </span>
                    <span className="text-[9px] font-medium tabular-nums text-primary/80">
                      {q.points}p
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 px-3 py-2.5">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Question {idx + 1}
                      </p>
                      {mode === "manage" ? (
                        <Badge
                          variant="outline"
                          className="h-5 px-1.5 text-[10px] font-normal"
                        >
                          {q.type}
                        </Badge>
                      ) : null}
                    </div>

                    <FormulaPreview
                      source={q.statementHtml}
                      className="mt-0 border-0 bg-transparent px-0 py-0 text-sm leading-relaxed"
                    />

                    <div className="mt-2.5">
                      {canAnswer ? (
                        q.type === "LONG_TEXT" || q.type === "SHORT_TEXT" ? (
                          <div className="space-y-1.5 rounded-lg border border-dashed border-border/80 bg-muted/20 p-2 dark:bg-muted/10">
                            {q.type === "SHORT_TEXT" ? (
                              <FormulaToolbar
                                variant="compact"
                                onInsert={(snippet) =>
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: {
                                      text: `${prev[q.id]?.text ?? ""}${snippet}`,
                                      optionIds: prev[q.id]?.optionIds ?? [],
                                    },
                                  }))
                                }
                              />
                            ) : null}
                            <Textarea
                              className="min-h-16 border-border/80 bg-background font-mono text-sm"
                              placeholder={
                                q.type === "SHORT_TEXT"
                                  ? "Réponse (nombre, fraction, formule…)"
                                  : "Votre rédaction…"
                              }
                              value={answers[q.id]?.text ?? ""}
                              onChange={(e) =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [q.id]: {
                                    ...prev[q.id],
                                    text: e.target.value,
                                    optionIds: prev[q.id]?.optionIds ?? [],
                                  },
                                }))
                              }
                            />
                            {answers[q.id]?.text ? (
                              <FormulaPreview
                                source={answers[q.id]?.text ?? ""}
                                emptyLabel=""
                                className="border-primary/15 bg-primary/[0.04] px-2 py-1.5 text-xs"
                              />
                            ) : null}
                          </div>
                        ) : q.type === "FILE" ? (
                          <p className="rounded-lg border border-dashed border-border px-2.5 py-2 text-xs text-muted-foreground">
                            Dépôt fichier à venir — indiquez le nom en question
                            texte si besoin.
                          </p>
                        ) : (
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {q.options.map((opt, optIdx) => {
                              const multi = q.type === "MULTIPLE_CHOICE";
                              const checked = (
                                answers[q.id]?.optionIds ?? []
                              ).includes(opt.id);
                              return (
                                <label
                                  key={opt.id}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition-all",
                                    checked
                                      ? "border-primary/45 bg-primary/10 shadow-sm ring-1 ring-primary/20"
                                      : "border-border bg-background hover:border-primary/30 hover:bg-muted/30",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
                                      checked
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground",
                                    )}
                                  >
                                    {optionLetter(optIdx)}
                                  </span>
                                  <input
                                    type={multi ? "checkbox" : "radio"}
                                    name={`q-${q.id}`}
                                    checked={checked}
                                    onChange={() => {
                                      setAnswers((prev) => {
                                        const cur = prev[q.id]?.optionIds ?? [];
                                        const next = multi
                                          ? checked
                                            ? cur.filter((id) => id !== opt.id)
                                            : [...cur, opt.id]
                                          : [opt.id];
                                        return {
                                          ...prev,
                                          [q.id]: {
                                            text: prev[q.id]?.text ?? "",
                                            optionIds: next,
                                          },
                                        };
                                      });
                                    }}
                                    className="sr-only"
                                  />
                                  <FormulaPreview
                                    source={opt.label}
                                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm"
                                  />
                                </label>
                              );
                            })}
                          </div>
                        )
                      ) : mode === "manage" ? (
                        q.options.length > 0 ? (
                          <div className="grid gap-1 sm:grid-cols-2">
                            {q.options.map((o, optIdx) => (
                              <div
                                key={o.id}
                                className={cn(
                                  "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs",
                                  o.isCorrect
                                    ? "border-emerald-500/30 bg-emerald-500/10"
                                    : "border-border/70 bg-muted/20",
                                )}
                              >
                                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-background text-[10px] font-bold text-muted-foreground">
                                  {optionLetter(optIdx)}
                                </span>
                                <FormulaPreview
                                  source={o.label}
                                  className="border-0 bg-transparent p-0 text-xs"
                                />
                                {o.isCorrect ? (
                                  <CheckCircle2 className="ml-auto size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs italic text-muted-foreground">
                            Réponse libre
                          </p>
                        )
                      ) : mode === "parent" ? (
                        <p className="text-xs text-muted-foreground">
                          Voir le suivi enfants ci-dessous.
                        </p>
                      ) : (
                        <div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
                          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Votre réponse
                          </p>
                          <FormulaPreview
                            source={
                              submission?.answers.find(
                                (a) => a.questionId === q.id,
                              )?.answerText ||
                              (notYetOpen
                                ? "Pas encore ouvert"
                                : "Réponse enregistrée / en attente")
                            }
                            className="border-0 bg-transparent p-0 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {canAnswer ? (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/25 bg-gradient-to-r from-card via-card to-primary/[0.06] px-3 py-2.5 shadow-md backdrop-blur supports-[backdrop-filter]:bg-card/90">
          <p className="hidden text-xs text-muted-foreground sm:block">
            Enregistrez un brouillon, puis soumettez avant l’échéance.
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={autosave}
            >
              Enregistrer
            </Button>
            <Button size="sm" disabled={pending} onClick={submit} className="gap-1.5">
              <Send className="size-3.5" />
              Soumettre
            </Button>
          </div>
        </div>
      ) : null}

      {(mode === "manage" || mode === "parent") && submissions.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-primary/[0.07] to-transparent px-3 py-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <ClipboardList className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">
                {mode === "parent" ? "Suivi enfants" : "Copies"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {submissions.length} élève{submissions.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {submissions.map((sub) => {
              const label =
                sub.status === "TODO"
                  ? "À faire"
                  : sub.status === "DRAFT"
                    ? "En cours"
                    : sub.status === "SUBMITTED"
                      ? "Rendu"
                      : sub.status === "GRADED"
                        ? "Noté"
                        : sub.status;
              const initials = (sub.studentName || "?")
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() ?? "")
                .join("");
              return (
                <li
                  key={sub.id}
                  className="px-3 py-2.5 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[11px] font-bold text-primary">
                        {initials || "?"}
                      </span>
                      <p className="truncate text-sm font-medium">
                        {sub.studentName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {assignment.resultsPublished
                          ? `${sub.finalScore ?? sub.provisionalScore ?? "—"}/${assignment.totalPoints}`
                          : mode === "parent"
                            ? "Note non publiée"
                            : `Prov. ${sub.provisionalScore ?? "—"}`}
                      </span>
                      <span
                        className={cn(
                          "inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-medium",
                          statusTone(label),
                        )}
                      >
                        {label}
                      </span>
                    </div>
                  </div>
                  {mode === "manage"
                    ? sub.answers
                        .filter((a) => a.needsManual)
                        .map((a) => (
                          <ManualGradeRow
                            key={a.questionId}
                            submissionId={sub.id}
                            questionId={a.questionId}
                            answerText={a.answerText}
                            pending={pending}
                            onDone={() => router.refresh()}
                          />
                        ))
                    : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </DevoirsShell>
  );
}

function ManualGradeRow({
  submissionId,
  questionId,
  answerText,
  pending,
  onDone,
}: {
  submissionId: string;
  questionId: string;
  answerText: string | null;
  pending: boolean;
  onDone: () => void;
}) {
  const [points, setPoints] = useState("0");
  const [feedback, setFeedback] = useState("");
  const [, startTransition] = useTransition();

  return (
    <div className="mt-1.5 space-y-1.5 rounded-md bg-muted/40 p-2 dark:bg-muted/20">
      <p className="line-clamp-2 text-[11px] text-muted-foreground">
        À corriger : {answerText || "(vide)"}
      </p>
      <div className="flex flex-wrap items-end gap-1.5">
        <div>
          <Label className="text-[10px]">Points</Label>
          <Input
            className="h-7 w-16 bg-background text-xs"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </div>
        <div className="min-w-[120px] flex-1">
          <Label className="text-[10px]">Commentaire</Label>
          <Input
            className="h-7 bg-background text-xs"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          className="h-7"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const [, err] = await gradeAnswerAction({
                submissionId,
                questionId,
                awardedPoints: Number(points) || 0,
                teacherFeedback: feedback || null,
              });
              if (err) toast.error(err.message);
              else {
                toast.success("Note enregistrée");
                onDone();
              }
            });
          }}
        >
          Noter
        </Button>
      </div>
    </div>
  );
}
