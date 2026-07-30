import {
  scoreExpectedAnswer,
  type ExpectedAnswerConfig,
} from "@/lib/online-assignments/formula";

export type AutoGradeQuestion = {
  type: string;
  points: number;
  options?: Array<{ id: string; isCorrect: boolean }>;
  correctAnswerJson?: unknown;
  settingsJson?: unknown;
};

export type StudentAnswerInput = {
  answerText?: string | null;
  answerJson?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function selectedIds(answer: StudentAnswerInput): string[] {
  const json = asRecord(answer.answerJson);
  if (!json) return [];
  if (Array.isArray(json.optionIds)) {
    return json.optionIds.filter((v): v is string => typeof v === "string");
  }
  if (typeof json.optionId === "string") return [json.optionId];
  if (typeof json.value === "boolean") {
    return [json.value ? "true" : "false"];
  }
  return [];
}

function expectedConfigFromQuestion(
  question: AutoGradeQuestion,
): ExpectedAnswerConfig | null {
  const correct = asRecord(question.correctAnswerJson);
  const settings = asRecord(question.settingsJson);
  if (!correct && !settings) return null;

  const expectedRaw =
    correct?.expected ??
    correct?.answers ??
    settings?.expectedAnswers ??
    null;
  const expected = Array.isArray(expectedRaw)
    ? expectedRaw.filter((v): v is string => typeof v === "string")
    : typeof expectedRaw === "string"
      ? [expectedRaw]
      : typeof correct?.value === "string"
        ? [correct.value]
        : typeof correct?.text === "string"
          ? [correct.text]
          : [];

  if (!expected.length) return null;

  const format =
    (typeof settings?.answerFormat === "string"
      ? settings.answerFormat
      : typeof correct?.format === "string"
        ? correct.format
        : "text") as ExpectedAnswerConfig["format"];

  return {
    format,
    expected,
    tolerance:
      typeof settings?.tolerance === "number"
        ? settings.tolerance
        : typeof correct?.tolerance === "number"
          ? correct.tolerance
          : 0.01,
    caseSensitive: Boolean(settings?.caseSensitive ?? correct?.caseSensitive),
  };
}

/** Points partiels sans pénalité pour QCM multi + réponses attendues auto. */
export function scoreAutoQuestion(
  question: AutoGradeQuestion,
  answer: StudentAnswerInput,
): { awardedPoints: number; isCorrect: boolean; needsManual: boolean } {
  const type = question.type;
  const points = Number(question.points) || 0;

  if (type === "FILE" || type === "LONG_TEXT") {
    // Long texte : auto si réponses attendues définies, sinon manuel
    if (type === "LONG_TEXT") {
      const config = expectedConfigFromQuestion(question);
      if (config) {
        return scoreExpectedAnswer(
          config,
          answer.answerText ?? "",
          points,
        );
      }
    }
    return { awardedPoints: 0, isCorrect: false, needsManual: true };
  }

  if (type === "SHORT_TEXT") {
    const config = expectedConfigFromQuestion(question);
    if (config) {
      return scoreExpectedAnswer(config, answer.answerText ?? "", points);
    }
    return { awardedPoints: 0, isCorrect: false, needsManual: true };
  }

  const options = question.options ?? [];
  const correctIds = options.filter((o) => o.isCorrect).map((o) => o.id);
  const picked = selectedIds(answer);

  if (type === "TRUE_FALSE" || type === "SINGLE_CHOICE") {
    const ok =
      picked.length === 1 &&
      correctIds.length === 1 &&
      picked[0] === correctIds[0];
    return {
      awardedPoints: ok ? points : 0,
      isCorrect: ok,
      needsManual: false,
    };
  }

  if (type === "MULTIPLE_CHOICE") {
    if (correctIds.length === 0) {
      return { awardedPoints: 0, isCorrect: false, needsManual: false };
    }
    const correctSet = new Set(correctIds);
    const pickedCorrect = picked.filter((id) => correctSet.has(id)).length;
    const pickedWrong = picked.filter((id) => !correctSet.has(id)).length;
    const ratio = pickedCorrect / correctIds.length;
    const awarded =
      pickedWrong > 0 && pickedCorrect === 0
        ? 0
        : Math.round(points * ratio * 100) / 100;
    const isCorrect =
      pickedWrong === 0 &&
      pickedCorrect === correctIds.length &&
      picked.length === correctIds.length;
    return { awardedPoints: awarded, isCorrect, needsManual: false };
  }

  return { awardedPoints: 0, isCorrect: false, needsManual: true };
}

export function sumScores(
  rows: Array<{ awardedPoints: number | null | undefined }>,
) {
  return rows.reduce((acc, row) => acc + (Number(row.awardedPoints) || 0), 0);
}
