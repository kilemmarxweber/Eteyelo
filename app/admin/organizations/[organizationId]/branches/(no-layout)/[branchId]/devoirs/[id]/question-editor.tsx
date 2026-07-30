"use client";

import { useRef, useState, useTransition } from "react";
import { FlaskConical, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { FormulaToolbar } from "./formula-toolbar";

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
      { clientKey: newKey(), label: "Option A", isCorrect: true },
      { clientKey: newKey(), label: "Option B", isCorrect: false },
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

type Props = {
  assignmentId: string;
  initialQuestions: EditableQuestion[];
  onSaved: () => void;
};

export function QuestionEditor({
  assignmentId,
  initialQuestions,
  onSaved,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [questions, setQuestions] = useState<EditableQuestion[]>(
    initialQuestions.length ? initialQuestions : [blankQuestion()],
  );
  const statementRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const insertAtCursor = (clientKey: string, snippet: string) => {
    const el = statementRefs.current[clientKey];
    const q = questions.find((x) => x.clientKey === clientKey);
    if (!q) return;
    if (!el) {
      updateQuestion(clientKey, {
        statementHtml: `${q.statementHtml}${snippet}`,
      });
      return;
    }
    const start = el.selectionStart ?? q.statementHtml.length;
    const end = el.selectionEnd ?? start;
    const next =
      q.statementHtml.slice(0, start) + snippet + q.statementHtml.slice(end);
    updateQuestion(clientKey, { statementHtml: next });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  };

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

  const validate = (): string | null => {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
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
  };

  const save = () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    startTransition(async () => {
      const payload = questions.map((q, index) => {
        const expected = q.expectedAnswers.map((a) => a.trim()).filter(Boolean);
        const isText = q.type === "SHORT_TEXT" || q.type === "LONG_TEXT";
        return {
          id: q.id,
          type: q.type,
          position: index,
          statementHtml: q.statementHtml.trim(),
          points: Number(q.points),
          options:
            q.type === "SHORT_TEXT" ||
            q.type === "LONG_TEXT" ||
            q.type === "FILE"
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

      const [, err] = await updateAssignmentAction({
        id: assignmentId,
        questions: payload,
      });
      if (err) {
        toast.error(err.message);
        return;
      }
      toast.success("Questionnaire enregistré.");
      onSaved();
    });
  };

  const totalPoints = questions.reduce(
    (acc, q) => acc + (Number(q.points) || 0),
    0,
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-gradient-to-br from-card via-card to-muted/30 p-4 shadow-sm dark:to-muted/10">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FlaskConical className="size-5 text-primary" />
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Éditeur de questionnaire
              </h2>
            </div>
            <p className="max-w-7xl text-sm text-muted-foreground">
              Rédigez l’énoncé (maths / chimie avec barre de formules), définissez
              les <strong className="text-foreground">réponses attendues</strong>{" "}
              que l’élève doit trouver, puis enregistrez avant de publier.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{questions.length} question(s)</Badge>
            <Badge variant="outline">{totalPoints} pts</Badge>
            <Button type="button" disabled={pending} onClick={save}>
              <Save className="mr-2 size-4" />
              Enregistrer
            </Button>
          </div>
        </div>
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
          <Plus className="mr-1 size-4" /> Vrai/Faux
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

      <div className="space-y-4">
        {questions.map((q, index) => {
          const isChoice =
            q.type === "SINGLE_CHOICE" ||
            q.type === "MULTIPLE_CHOICE" ||
            q.type === "TRUE_FALSE";
          const isText = q.type === "SHORT_TEXT" || q.type === "LONG_TEXT";

          return (
            <Card
              key={q.clientKey}
              className="overflow-hidden border-border bg-card shadow-sm"
            >
              <CardHeader className="border-b border-border bg-muted/30 dark:bg-muted/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base">
                      Question {index + 1}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {QUESTION_TYPES.find((t) => t.value === q.type)?.label}
                    </p>
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
              </CardHeader>

              <CardContent className="grid gap-5 pt-5">
                <div className="grid gap-4 md:grid-cols-[1fr_120px]">
                  <div className="space-y-2">
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
                  <div className="space-y-2">
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

                <div className="space-y-2">
                  <Label>Énoncé (texte + formules)</Label>
                  <FormulaToolbar
                    variant="full"
                    onInsert={(snippet) =>
                      insertAtCursor(q.clientKey, snippet)
                    }
                  />
                  <Textarea
                    ref={(el) => {
                      statementRefs.current[q.clientKey] = el;
                    }}
                    className="min-h-28 bg-background font-mono text-sm"
                    placeholder="Ex. Calculez $\frac{3}{4}+\frac{1}{2}$. Équilibrez $\mathrm{H_2} + \mathrm{O_2} \rightarrow \mathrm{H_2O}$."
                    value={q.statementHtml}
                    onChange={(e) =>
                      updateQuestion(q.clientKey, {
                        statementHtml: e.target.value,
                      })
                    }
                  />
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Aperçu élève
                    </Label>
                    <FormulaPreview source={q.statementHtml} />
                  </div>
                </div>

                {isText ? (
                  <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 dark:bg-primary/10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Label className="text-sm font-semibold">
                          Réponses attendues (correction auto)
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          L’élève doit trouver une de ces valeurs. Ajoutez des
                          variantes acceptées.
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
                      <div className="space-y-2">
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
                        <div className="space-y-2">
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
                  <div className="space-y-3">
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
                                  label: `Option ${String.fromCharCode(65 + q.options.length)}`,
                                  isCorrect: false,
                                },
                              ],
                            })
                          }
                        >
                          <Plus className="mr-1 size-3.5" /> Option
                        </Button>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      {q.options.map((opt) => (
                        <div
                          key={opt.clientKey}
                          className="flex items-center gap-2 rounded-lg border border-border bg-background p-2"
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
                            className="bg-background"
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
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <Button
          type="button"
          size="lg"
          className="shadow-lg"
          disabled={pending}
          onClick={save}
        >
          <Save className="mr-2 size-4" />
          Enregistrer le questionnaire
        </Button>
      </div>
    </div>
  );
}
