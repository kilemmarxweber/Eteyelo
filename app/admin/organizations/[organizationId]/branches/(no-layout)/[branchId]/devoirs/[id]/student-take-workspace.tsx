"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  Clock,
  Save,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  saveAnswersAction,
  submitAssignmentAction,
} from "@/lib/online-assignments/actions";
import { cn } from "@/lib/utils";

import { DevoirsShell } from "../devoirs-shell";
import { FormulaPreview } from "./formula-preview";
import { FormulaToolbar } from "./formula-toolbar";

type Question = {
  id: string;
  type: string;
  position: number;
  statementHtml: string;
  points: number;
  options: Array<{ id: string; label: string }>;
};

type Submission = {
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

type Props = {
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
  };
  submission: Submission;
};

function optionLetter(index: number) {
  return String.fromCharCode(65 + index);
}

function shuffleInPlace<T>(items: T[], seed: string) {
  const arr = [...items];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const j = h % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isAnswered(
  q: Question,
  ans: { text: string; optionIds: string[] } | undefined,
) {
  if (!ans) return false;
  if (q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE") {
    return ans.optionIds.length > 0;
  }
  if (q.type === "MULTIPLE_CHOICE") return ans.optionIds.length > 0;
  return Boolean(ans.text.trim());
}

/** Espace de réponse élève : questions, brouillon, soumission. */
export function StudentTakeWorkspace({
  organizationId,
  branchId,
  assignment,
  submission,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const base = `/admin/organizations/${organizationId}/branches/${branchId}/devoirs`;

  const questions = useMemo(() => {
    return assignment.questions.map((q) => ({
      ...q,
      options: assignment.shuffleOptions
        ? shuffleInPlace(q.options, `${assignment.id}:${q.id}`)
        : q.options,
    }));
  }, [assignment]);

  const initialAnswers = useMemo(() => {
    const map: Record<string, { text: string; optionIds: string[] }> = {};
    for (const q of questions) {
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
  }, [questions, submission]);

  const [answers, setAnswers] = useState(initialAnswers);
  const [activeId, setActiveId] = useState(questions[0]?.id ?? "");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    setAnswers(initialAnswers);
  }, [initialAnswers]);

  const locked =
    submission?.status === "SUBMITTED" || submission?.status === "GRADED";
  const now = Date.now();
  const notYetOpen = now < new Date(assignment.startAt).getTime();
  const pastDue = now > new Date(assignment.dueAt).getTime();
  const canAnswer =
    assignment.status === "PUBLISHED" && !locked && !notYetOpen && !pastDue;

  const answeredCount = questions.filter((q) =>
    isAnswered(q, answers[q.id]),
  ).length;
  const progress =
    questions.length > 0
      ? Math.round((answeredCount / questions.length) * 100)
      : 0;

  const buildPayload = (
    map: Record<string, { text: string; optionIds: string[] }> = answers,
  ) =>
    questions.map((q) => ({
      questionId: q.id,
      answerText: map[q.id]?.text || null,
      answerJson:
        q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE"
          ? { optionId: map[q.id]?.optionIds[0] ?? null }
          : q.type === "MULTIPLE_CHOICE"
            ? { optionIds: map[q.id]?.optionIds ?? [] }
            : null,
    }));

  const save = (
    silent = false,
    map?: Record<string, { text: string; optionIds: string[] }>,
  ) => {
    if (!canAnswer) return;
    const payload = buildPayload(map ?? answers);
    startTransition(async () => {
      const [, err] = await saveAnswersAction({
        assignmentId: assignment.id,
        answers: payload,
      });
      if (err) {
        toast.error(err.message);
        return;
      }
      setLastSavedAt(new Date());
      if (!silent) toast.success("Brouillon enregistré");
    });
  };

  const submit = () => {
    if (!canAnswer) return;
    if (answeredCount < questions.length) {
      const ok = window.confirm(
        `Vous n’avez répondu qu’à ${answeredCount}/${questions.length} questions. Soumettre quand même ?`,
      );
      if (!ok) return;
    }
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
          ? `Soumis. Note provisoire ${res.provisionalScore} (correction en attente).`
          : `Soumis et noté : ${res.provisionalScore}/${assignment.totalPoints}`,
      );
      router.refresh();
    });
  };

  const activeQ = questions.find((q) => q.id === activeId) ?? questions[0];

  const dueLabel = new Date(assignment.dueAt).toLocaleString("fr-CD", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <DevoirsShell
      title={assignment.title}
      listHref={base}
      description={`${assignment.courseName} · ${assignment.className}`}
      badge={
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          {assignment.type === "EVALUATION" ? "Évaluation" : "Devoir"}
        </Badge>
      }
    >
      {/* Barre de session */}
      <section className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.09] via-card to-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">
              {notYetOpen
                ? "Pas encore ouvert"
                : locked
                  ? submission?.status === "GRADED"
                    ? "Devoir noté"
                    : "Devoir rendu"
                  : pastDue
                    ? "Échéance dépassée"
                    : "Espace de réponse"}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5 text-primary" />
                Limite {dueLabel}
              </span>
              <span>·</span>
              <span>
                {answeredCount}/{questions.length} répondu
                {answeredCount > 1 ? "es" : "e"}
              </span>
              {lastSavedAt ? (
                <>
                  <span>·</span>
                  <span>
                    Enregistré {lastSavedAt.toLocaleTimeString("fr-CD", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </>
              ) : null}
              {assignment.resultsPublished &&
              (submission?.finalScore != null ||
                submission?.provisionalScore != null) ? (
                <>
                  <span>·</span>
                  <span className="font-semibold text-primary">
                    Note {submission?.finalScore ?? submission?.provisionalScore}/
                    {assignment.totalPoints}
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <div className="h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        {assignment.description ? (
          <p className="mt-2 border-t border-border/60 pt-2 text-xs leading-relaxed text-foreground/85">
            {assignment.description}
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Sommaire questions */}
        <aside className="h-fit rounded-xl border border-border bg-card p-2 shadow-sm lg:sticky lg:top-16">
          <p className="mb-2 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Questions
          </p>
          <ul className="space-y-1">
            {questions.map((q, idx) => {
              const done = isAnswered(q, answers[q.id]);
              const active = q.id === activeQ?.id;
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(q.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition",
                      active
                        ? "bg-primary/10 text-primary ring-1 ring-primary/25"
                        : "hover:bg-muted/50 text-foreground",
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate font-medium">Q{idx + 1}</span>
                    <span className="ml-auto tabular-nums text-[10px] text-muted-foreground">
                      {q.points}p
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Zone de réponse active */}
        {activeQ ? (
          <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-gradient-to-r from-primary/[0.07] to-transparent px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">
                  Question {questions.findIndex((q) => q.id === activeQ.id) + 1}
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    · {activeQ.points} point{activeQ.points > 1 ? "s" : ""}
                  </span>
                </p>
                <Badge variant="outline" className="h-5 text-[10px]">
                  {activeQ.type.replaceAll("_", " ")}
                </Badge>
              </div>
            </div>

            <div className="space-y-4 p-3 sm:p-4">
              <FormulaPreview
                source={activeQ.statementHtml}
                className="border-0 bg-transparent px-0 py-0 text-sm leading-relaxed md:text-base"
              />

              {canAnswer ? (
                activeQ.type === "LONG_TEXT" ||
                activeQ.type === "SHORT_TEXT" ? (
                  <div className="space-y-2 rounded-xl border border-dashed border-primary/25 bg-primary/[0.03] p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Votre réponse
                    </p>
                    {activeQ.type === "SHORT_TEXT" ? (
                      <FormulaToolbar
                        variant="compact"
                        onInsert={(snippet) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [activeQ.id]: {
                              text: `${prev[activeQ.id]?.text ?? ""}${snippet}`,
                              optionIds: prev[activeQ.id]?.optionIds ?? [],
                            },
                          }))
                        }
                      />
                    ) : null}
                    <Textarea
                      className={cn(
                        "bg-background font-mono text-sm",
                        activeQ.type === "LONG_TEXT" ? "min-h-36" : "min-h-20",
                      )}
                      placeholder={
                        activeQ.type === "SHORT_TEXT"
                          ? "Nombre, fraction, formule…"
                          : "Rédigez votre réponse…"
                      }
                      value={answers[activeQ.id]?.text ?? ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [activeQ.id]: {
                            text: e.target.value,
                            optionIds: prev[activeQ.id]?.optionIds ?? [],
                          },
                        }))
                      }
                      onBlur={() => save(true)}
                    />
                    {answers[activeQ.id]?.text ? (
                      <FormulaPreview
                        source={answers[activeQ.id]?.text ?? ""}
                        emptyLabel=""
                        className="border-primary/15 bg-background px-2 py-1.5 text-xs"
                      />
                    ) : null}
                  </div>
                ) : activeQ.type === "FILE" ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                    Dépôt de fichier bientôt disponible. Utilisez une question
                    texte si besoin.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Choisissez {activeQ.type === "MULTIPLE_CHOICE" ? "une ou plusieurs réponses" : "une réponse"}
                    </p>
                    <div className="grid gap-2">
                      {activeQ.options.map((opt, optIdx) => {
                        const multi = activeQ.type === "MULTIPLE_CHOICE";
                        const checked = (
                          answers[activeQ.id]?.optionIds ?? []
                        ).includes(opt.id);
                        return (
                          <label
                            key={opt.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-all",
                              checked
                                ? "border-primary/45 bg-primary/10 shadow-sm ring-1 ring-primary/20"
                                : "border-border bg-background hover:border-primary/30 hover:bg-muted/30",
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                                checked
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {optionLetter(optIdx)}
                            </span>
                            <input
                              type={multi ? "checkbox" : "radio"}
                              name={`q-${activeQ.id}`}
                              checked={checked}
                              className="sr-only"
                              onChange={() => {
                                const cur =
                                  answers[activeQ.id]?.optionIds ?? [];
                                const nextIds = multi
                                  ? checked
                                    ? cur.filter((id) => id !== opt.id)
                                    : [...cur, opt.id]
                                  : [opt.id];
                                const next = {
                                  ...answers,
                                  [activeQ.id]: {
                                    text: answers[activeQ.id]?.text ?? "",
                                    optionIds: nextIds,
                                  },
                                };
                                setAnswers(next);
                                save(true, next);
                              }}
                            />
                            <FormulaPreview
                              source={opt.label}
                              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )
              ) : (
                <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {notYetOpen ? "Pas encore ouvert" : "Votre réponse"}
                  </p>
                  <FormulaPreview
                    source={
                      submission?.answers.find((a) => a.questionId === activeQ.id)
                        ?.answerText ||
                      (answers[activeQ.id]?.optionIds.length
                        ? activeQ.options
                            .filter((o) =>
                              answers[activeQ.id]?.optionIds.includes(o.id),
                            )
                            .map((o) => o.label)
                            .join(" · ")
                        : notYetOpen
                          ? "Les réponses s’ouvriront à l’heure indiquée."
                          : "Aucune réponse enregistrée")
                    }
                    className="border-0 bg-transparent p-0 text-sm"
                  />
                  {assignment.resultsPublished
                    ? (() => {
                        const a = submission?.answers.find(
                          (x) => x.questionId === activeQ.id,
                        );
                        if (!a || a.awardedPoints == null) return null;
                        return (
                          <p className="mt-2 text-xs font-medium text-primary">
                            Points : {a.awardedPoints}/{activeQ.points}
                            {a.teacherFeedback
                              ? ` — ${a.teacherFeedback}`
                              : ""}
                          </p>
                        );
                      })()
                    : null}
                </div>
              )}

              <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={
                    questions.findIndex((q) => q.id === activeQ.id) <= 0
                  }
                  onClick={() => {
                    const i = questions.findIndex((q) => q.id === activeQ.id);
                    if (i > 0) setActiveId(questions[i - 1].id);
                  }}
                >
                  Précédent
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={
                    questions.findIndex((q) => q.id === activeQ.id) >=
                    questions.length - 1
                  }
                  onClick={() => {
                    const i = questions.findIndex((q) => q.id === activeQ.id);
                    if (i < questions.length - 1) {
                      setActiveId(questions[i + 1].id);
                    }
                  }}
                >
                  Suivant
                </Button>
              </div>
            </div>
          </article>
        ) : null}
      </div>

      {canAnswer ? (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/25 bg-card/95 px-3 py-2.5 shadow-md backdrop-blur">
          <p className="text-xs text-muted-foreground">
            {answeredCount}/{questions.length} · Enregistrez souvent, puis
            soumettez avant l’échéance.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => save(false)}
              className="gap-1.5"
            >
              <Save className="size-3.5" />
              Enregistrer
            </Button>
            <Button
              size="sm"
              disabled={pending}
              onClick={submit}
              className="gap-1.5"
            >
              <Send className="size-3.5" />
              Soumettre
            </Button>
          </div>
        </div>
      ) : null}
    </DevoirsShell>
  );
}
