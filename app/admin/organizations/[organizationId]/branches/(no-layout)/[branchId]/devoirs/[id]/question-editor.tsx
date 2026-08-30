"use client";

import {
  forwardRef,
  useImperativeHandle,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { FlaskConical, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { updateAssignmentAction } from "@/lib/online-assignments/actions";
import type { AnswerFormat } from "@/lib/online-assignments/formula";

import { FormulaPreview } from "./formula-preview";
import { StatementFormulaEditor } from "./statement-formula-editor";

export type EditableOption = {
  id?: string;
  clientKey: string;
  label: string;
  isCorrect: boolean;
};

export type EditableQuestion = {
  id?: string;
  clientKey: string;
  type:
    | "SHORT_TEXT"
    | "LONG_TEXT"
    | "FILE"
    | "SINGLE_CHOICE"
    | "MULTIPLE_CHOICE"
    | "TRUE_FALSE";
  statementHtml: string;
  points: number;
  options: EditableOption[];
  answerFormat: AnswerFormat;
  expectedAnswers: string[];
  tolerance: number;
};

export type QuestionPayload = {
  id?: string;
  type: EditableQuestion["type"];
  position: number;
  statementHtml: string;
  points: number;
  options: Array<{
    id?: string;
    label: string;
    isCorrect: boolean;
    position: number;
  }>;
  settingsJson: Record<string, unknown> | null;
  correctAnswerJson: unknown;
};

const QUESTION_TYPES: Array<{
  value: EditableQuestion["type"];
  label: string;
}> = [
  { value: "SHORT_TEXT", label: "Réponse courte / calcul / formule" },
  { value: "LONG_TEXT", label: "Réponse longue (rédaction)" },
  { value: "FILE", label: "Fichier à déposer" },
  { value: "SINGLE_CHOICE", label: "QCM — 1 bonne réponse" },
  { value: "MULTIPLE_CHOICE", label: "QCM — plusieurs bonnes" },
  { value: "TRUE_FALSE", label: "Vrai / Faux" },
];

const FORMAT_OPTIONS: Array<{ value: AnswerFormat; label: string }> = [
  { value: "text", label: "Texte" },
  { value: "number", label: "Nombre / calcul" },
  { value: "fraction", label: "Fraction (ex. 3/4)" },
  { value: "formula", label: "Formule maths" },
  { value: "chemistry", label: "Formule chimique" },
];

function newKey() {
  return `tmp_${Math.random().toString(36).slice(2, 10)}`;
}

function blankOptionsForType(type: EditableQuestion["type"]): EditableOption[] {
  if (type === "TRUE_FALSE") {
    return [
      { clientKey: newKey(), label: "Vrai", isCorrect: true },
      { clientKey: newKey(), label: "Faux", isCorrect: false },
    ];
  }
  if (type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE") {
    return [
      { clientKey: newKey(), label: "Choix A", isCorrect: true },
      { clientKey: newKey(), label: "Choix B", isCorrect: false },
    ];
  }
  return [];
}

function blankQuestion(
  type: EditableQuestion["type"] = "SHORT_TEXT",
): EditableQuestion {
  return {
    clientKey: newKey(),
    type,
    statementHtml: "",
    points: type === "LONG_TEXT" || type === "FILE" ? 5 : 2,
    options: blankOptionsForType(type),
    answerFormat: "text",
    expectedAnswers: type === "SHORT_TEXT" ? [""] : [],
    tolerance: 0.01,
  };
}

function parseExpected(correctAnswerJson: unknown, settingsJson: unknown) {
  const correct =
    correctAnswerJson && typeof correctAnswerJson === "object"
      ? (correctAnswerJson as Record<string, unknown>)
      : null;
  const settings =
    settingsJson && typeof settingsJson === "object"
      ? (settingsJson as Record<string, unknown>)
      : null;
  const raw =
    correct?.expected ??
    correct?.answers ??
    settings?.expectedAnswers ??
    null;
  const expected = Array.isArray(raw)
    ? raw.filter((v): v is string => typeof v === "string")
    : typeof correct?.value === "string"
      ? [correct.value]
      : [];
  const format = (settings?.answerFormat ??
    correct?.format ??
    "text") as AnswerFormat;
  const tolerance =
    typeof settings?.tolerance === "number"
      ? settings.tolerance
      : typeof correct?.tolerance === "number"
        ? correct.tolerance
        : 0.01;
  return { expected, format, tolerance };
}

export function questionsFromServer(
  questions: Array<{
    id: string;
    type: string;
    statementHtml: string;
    points: number;
    options: Array<{ id: string; label: string; isCorrect?: boolean }>;
    correctAnswerJson?: unknown;
    settingsJson?: unknown;
  }>,
): EditableQuestion[] {
  return questions.map((q) => {
    const parsed = parseExpected(q.correctAnswerJson, q.settingsJson);
    return {
      id: q.id,
      clientKey: q.id,
      type: q.type as EditableQuestion["type"],
      statementHtml: q.statementHtml,
      points: q.points,
      options:
        q.type === "TRUE_FALSE" && q.options.length === 0
          ? blankOptionsForType("TRUE_FALSE")
          : q.options.map((o) => ({
              id: o.id,
              clientKey: o.id,
              label: o.label,
              isCorrect: Boolean(o.isCorrect),
            })),
      answerFormat: parsed.format,
      expectedAnswers:
        q.type === "SHORT_TEXT" || q.type === "LONG_TEXT"
          ? parsed.expected.length
            ? parsed.expected
            : [""]
          : [],
      tolerance: parsed.tolerance,
    };
  });
}

export function validateEditableQuestions(
  questions: EditableQuestion[],
): string | null {
  if (!questions.length) {
    return "Ajoutez au moins une question.";
  }
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    if (!q.statementHtml.trim()) {
      return `Question ${i + 1} : énoncé obligatoire.`;
    }
    if (!(Number(q.points) > 0)) {
      return `Question ${i + 1} : points > 0 requis.`;
    }
    if (
      q.type === "SINGLE_CHOICE" ||
      q.type === "MULTIPLE_CHOICE" ||
      q.type === "TRUE_FALSE"
    ) {
      if (q.options.length < 2) return `Question ${i + 1} : au moins 2 options.`;
      if (q.options.some((o) => !o.label.trim())) {
        return `Question ${i + 1} : option vide.`;
      }
      if (!q.options.some((o) => o.isCorrect)) {
        return `Question ${i + 1} : cochez au moins une bonne réponse.`;
      }
    }
    if (q.type === "SHORT_TEXT") {
      const filled = q.expectedAnswers.map((a) => a.trim()).filter(Boolean);
      if (!filled.length) {
        return `Question ${i + 1} : indiquez au moins une réponse attendue (pour correction auto).`;
      }
    }
  }
  return null;
}

export function toQuestionPayload(
  questions: EditableQuestion[],
): QuestionPayload[] {
  return questions.map((q, index) => {
    const expected = q.expectedAnswers.map((a) => a.trim()).filter(Boolean);
    const isText = q.type === "SHORT_TEXT" || q.type === "LONG_TEXT";
    return {
      id: q.id,
      type: q.type,
      position: index,
      statementHtml: q.statementHtml.trim(),
      points: Number(q.points),
      options:
        q.type === "SHORT_TEXT" || q.type === "LONG_TEXT" || q.type === "FILE"
          ? []
          : q.options.map((o, j) => ({
              id: o.id,
              label: o.label.trim(),
              isCorrect: o.isCorrect,
              position: j,
            })),
      settingsJson: isText
        ? {
            answerFormat: q.answerFormat,
            tolerance: q.tolerance,
            expectedAnswers: expected,
          }
        : null,
      correctAnswerJson:
        q.type === "TRUE_FALSE"
          ? {
              value: q.options.find((o) => o.isCorrect)?.label === "Vrai",
            }
          : isText && expected.length
            ? {
                format: q.answerFormat,
                expected,
                tolerance: q.tolerance,
              }
            : null,
    };
  });
}

export type QuestionEditorHandle = {
  /** Valide et renvoie le payload, ou null si invalide (toast déjà affiché). */
  getValidatedPayload: () => QuestionPayload[] | null;
};

type Props = {
  assignmentId?: string;
  initialQuestions?: EditableQuestion[];
  onSaved?: () => void;
  /** Masque la barre Enregistrer (le parent gère Enregistrer / Publier). */
  hideFooter?: boolean;
  footerHint?: string;
  headerHint?: string;
  extraFooterActions?: ReactNode;
};

export const QuestionEditor = forwardRef<QuestionEditorHandle, Props>(
  function QuestionEditor(
    {
      assignmentId,
      initialQuestions = [],
      onSaved,
      hideFooter = false,
      footerHint,
      headerHint,
      extraFooterActions,
    },
    ref,
  ) {
  const [pending, startTransition] = useTransition();
  const [questions, setQuestions] = useState<EditableQuestion[]>(
    initialQuestions.length ? initialQuestions : [blankQuestion()],
  );

  useImperativeHandle(ref, () => ({
    getValidatedPayload: () => {
      const error = validateEditableQuestions(questions);
      if (error) {
        toast.error(error);
        return null;
      }
      return toQuestionPayload(questions);
    },
  }));

  const updateQuestion = (
    clientKey: string,
    patch: Partial<EditableQuestion>,
  ) => {
    setQuestions((prev) =>
      prev.map((q) => (q.clientKey === clientKey ? { ...q, ...patch } : q)),
    );
  };

  const changeType = (clientKey: string, type: EditableQuestion["type"]) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.clientKey !== clientKey) return q;
        const isText = type === "SHORT_TEXT" || type === "LONG_TEXT";
        return {
          ...q,
          type,
          options: blankOptionsForType(type),
          expectedAnswers: isText
            ? q.expectedAnswers.length
              ? q.expectedAnswers
              : [""]
            : [],
          answerFormat: type === "SHORT_TEXT" ? q.answerFormat : "text",
        };
      }),
    );
  };

  const updateOption = (
    qKey: string,
    optKey: string,
    patch: Partial<EditableOption>,
  ) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.clientKey !== qKey) return q;
        let options = q.options.map((o) =>
          o.clientKey === optKey ? { ...o, ...patch } : o,
        );
        if (
          patch.isCorrect === true &&
          (q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE")
        ) {
          options = options.map((o) => ({
            ...o,
            isCorrect: o.clientKey === optKey,
          }));
        }
        return { ...q, options };
      }),
    );
  };

  const save = () => {
    if (!assignmentId) {
      toast.error("Devoir introuvable.");
      return;
    }
    const error = validateEditableQuestions(questions);
    if (error) {
      toast.error(error);
      return;
    }
    startTransition(async () => {
      const payload = toQuestionPayload(questions);
      const [, err] = await updateAssignmentAction({
        id: assignmentId,
        questions: payload,
      });
      if (err) {
        toast.error(err.message);
        return;
      }
      toast.success("Enregistré.");
      onSaved?.();
    });
  };

  const totalPoints = questions.reduce(
    (acc, q) => acc + (Number(q.points) || 0),
    0,
  );

  const questionCountLabel =
    questions.length <= 1
      ? `${questions.length} question`
      : `${questions.length} questions`;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <FlaskConical className="size-4 shrink-0 text-primary" />
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Éditeur de questionnaire
            </h2>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md border border-border bg-muted/40 px-2 py-1">
              {questionCountLabel}
            </span>
            <span className="rounded-md border border-border bg-muted/40 px-2 py-1 tabular-nums">
              {totalPoints} point{totalPoints > 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {headerHint ??
            "Rédigez les questions. Ensuite, enregistrez ou publiez selon votre choix."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            setQuestions((prev) => [...prev, blankQuestion("SHORT_TEXT")])
          }
        >
          <Plus className="mr-1 size-4" /> Calcul / formule
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            setQuestions((prev) => [...prev, blankQuestion("SINGLE_CHOICE")])
          }
        >
          <Plus className="mr-1 size-4" /> QCM
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            setQuestions((prev) => [...prev, blankQuestion("TRUE_FALSE")])
          }
        >
          <Plus className="mr-1 size-4" /> Vrai / Faux
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            setQuestions((prev) => [...prev, blankQuestion("LONG_TEXT")])
          }
        >
          <Plus className="mr-1 size-4" /> Rédaction
        </Button>
      </div>

      <div className="space-y-3">
        {questions.map((q, index) => {
          const isChoice =
            q.type === "SINGLE_CHOICE" ||
            q.type === "MULTIPLE_CHOICE" ||
            q.type === "TRUE_FALSE";
          const isText = q.type === "SHORT_TEXT" || q.type === "LONG_TEXT";

          return (
            <section
              key={q.clientKey}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border/80 px-3 py-2.5 sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-[11px] font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      Question {index + 1}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {QUESTION_TYPES.find((t) => t.value === q.type)?.label}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  disabled={pending || questions.length <= 1}
                  onClick={() =>
                    setQuestions((prev) => {
                      const next = prev.filter(
                        (x) => x.clientKey !== q.clientKey,
                      );
                      return next.length ? next : [blankQuestion()];
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid gap-4 p-3 sm:p-4">
                <div className="grid gap-3 md:grid-cols-[1fr_100px]">
                  <div className="space-y-1.5">
                    <Label>Type de question</Label>
                    <Select
                      value={q.type}
                      onValueChange={(v) =>
                        changeType(q.clientKey, v as EditableQuestion["type"])
                      }
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUESTION_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Points</Label>
                    <Input
                      type="number"
                      min={0.5}
                      step={0.5}
                      className="bg-background"
                      value={q.points}
                      onChange={(e) =>
                        updateQuestion(q.clientKey, {
                          points: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>

                <StatementFormulaEditor
                  value={q.statementHtml}
                  onChange={(statementHtml) =>
                    updateQuestion(q.clientKey, { statementHtml })
                  }
                />

                {isText ? (
                  <div className="space-y-3 border-t border-border/70 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Label className="text-sm font-semibold">
                          Réponses attendues
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Valeurs acceptées pour la correction automatique.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          updateQuestion(q.clientKey, {
                            expectedAnswers: [...q.expectedAnswers, ""],
                          })
                        }
                      >
                        <Plus className="mr-1 size-3.5" /> Variante
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Format de réponse</Label>
                        <Select
                          value={q.answerFormat}
                          onValueChange={(v) =>
                            updateQuestion(q.clientKey, {
                              answerFormat: v as AnswerFormat,
                            })
                          }
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FORMAT_OPTIONS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {q.answerFormat === "number" ? (
                        <div className="space-y-1.5">
                          <Label>Tolérance</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.001}
                            className="bg-background"
                            value={q.tolerance}
                            onChange={(e) =>
                              updateQuestion(q.clientKey, {
                                tolerance: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      {q.expectedAnswers.map((ans, ansIdx) => (
                        <div key={ansIdx} className="flex gap-2">
                          <Input
                            className="bg-background font-mono"
                            placeholder={
                              q.answerFormat === "chemistry"
                                ? "Ex. H2O ou $H_2O$"
                                : q.answerFormat === "fraction"
                                  ? "Ex. 5/4"
                                  : q.answerFormat === "number"
                                    ? "Ex. 1.25"
                                    : q.answerFormat === "formula"
                                      ? "Ex. x^2+1"
                                      : "Réponse exacte attendue"
                            }
                            value={ans}
                            onChange={(e) => {
                              const next = [...q.expectedAnswers];
                              next[ansIdx] = e.target.value;
                              updateQuestion(q.clientKey, {
                                expectedAnswers: next,
                              });
                            }}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={q.expectedAnswers.length <= 1}
                            onClick={() =>
                              updateQuestion(q.clientKey, {
                                expectedAnswers: q.expectedAnswers.filter(
                                  (_, i) => i !== ansIdx,
                                ),
                              })
                            }
                          >
                            <Trash2 className="size-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    {q.expectedAnswers.some((a) => a.trim()) ? (
                      <FormulaPreview
                        source={q.expectedAnswers.filter(Boolean).join(" ; ")}
                        emptyLabel=""
                      />
                    ) : null}
                  </div>
                ) : null}

                {isChoice ? (
                  <div className="space-y-3 border-t border-border/70 pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label>
                        Options — cochez la/les bonne(s) réponse(s)
                      </Label>
                      {q.type !== "TRUE_FALSE" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateQuestion(q.clientKey, {
                              options: [
                                ...q.options,
                                {
                                  clientKey: newKey(),
                                  label: `Choix ${String.fromCharCode(65 + q.options.length)}`,
                                  isCorrect: false,
                                },
                              ],
                            })
                          }
                        >
                          <Plus className="mr-1 size-3.5" /> Choix
                        </Button>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      {q.options.map((opt) => (
                        <div
                          key={opt.clientKey}
                          className="flex items-center gap-2 rounded-lg border border-border/80 bg-background px-2 py-1.5"
                        >
                          <Checkbox
                            checked={opt.isCorrect}
                            onCheckedChange={(checked) =>
                              updateOption(q.clientKey, opt.clientKey, {
                                isCorrect: checked === true,
                              })
                            }
                          />
                          <Input
                            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                            value={opt.label}
                            disabled={q.type === "TRUE_FALSE"}
                            onChange={(e) =>
                              updateOption(q.clientKey, opt.clientKey, {
                                label: e.target.value,
                              })
                            }
                          />
                          {q.type !== "TRUE_FALSE" ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={q.options.length <= 2}
                              onClick={() =>
                                updateQuestion(q.clientKey, {
                                  options: q.options.filter(
                                    (o) => o.clientKey !== opt.clientKey,
                                  ),
                                })
                              }
                            >
                              <Trash2 className="size-4 text-muted-foreground" />
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {q.type === "FILE" ? (
                  <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                    L’élève déposera un fichier (PDF / image). Correction
                    manuelle.
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {!hideFooter ? (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-card/95 px-3 py-2.5 shadow-md backdrop-blur supports-[backdrop-filter]:bg-card/90">
          <p className="hidden text-xs text-muted-foreground sm:block">
            {footerHint ??
              `${questionCountLabel} · ${totalPoints} point${
                totalPoints > 1 ? "s" : ""
              } — Enregistrer ou Publier.`}
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {extraFooterActions}
            {assignmentId ? (
              <Button type="button" disabled={pending} onClick={save}>
                <Save className="mr-2 size-4" />
                Enregistrer
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
},
);
