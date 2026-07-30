import katex from "katex";

/** Extrait et rend les segments `$...$` / `$$...$$` en HTML KaTeX. */
export function renderFormulaHtml(source: string): string {
  if (!source) return "";
  const escaped = source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const withBlocks = escaped.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => {
    try {
      return katex.renderToString(tex.trim(), {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      return `<code>${tex}</code>`;
    }
  });

  return withBlocks.replace(/\$([^$\n]+?)\$/g, (_, tex: string) => {
    try {
      return katex.renderToString(tex.trim(), {
        throwOnError: false,
        displayMode: false,
      });
    } catch {
      return `<code>${tex}</code>`;
    }
  });
}

export function normalizeComparableText(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/,/g, ".")
    .replace(/\u2212/g, "-");
}

/** Normalise une formule simple (espaces, ^, _, indices chimiques courants). */
export function normalizeFormula(value: string) {
  return normalizeComparableText(value)
    .replace(/\$/g, "")
    .replace(/[{}]/g, "")
    .replace(/\^/g, "")
    .replace(/_/g, "")
    .replace(/\\mathrm|\\text|\\ce|\\frac|\\sqrt|\\times|\\cdot/g, "")
    .replace(/→|->|=>|⟶/g, "->")
    .replace(/\s+/g, "");
}

export function parseNumberLoose(value: string): number | null {
  const n = Number(normalizeComparableText(value).replace(/[^0-9.\-eE]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export type AnswerFormat =
  | "text"
  | "number"
  | "fraction"
  | "formula"
  | "chemistry";

export type ExpectedAnswerConfig = {
  format: AnswerFormat;
  /** Réponses acceptées (texte, nombre, latex, formule chimique). */
  expected: string[];
  /** Tolérance relative/absolue pour les nombres. */
  tolerance?: number;
  caseSensitive?: boolean;
};

export function scoreExpectedAnswer(
  config: ExpectedAnswerConfig | null | undefined,
  studentRaw: string,
  points: number,
): { awardedPoints: number; isCorrect: boolean; needsManual: boolean } {
  if (!config || !config.expected?.length) {
    return { awardedPoints: 0, isCorrect: false, needsManual: true };
  }

  const student = studentRaw?.trim() ?? "";
  if (!student) {
    return { awardedPoints: 0, isCorrect: false, needsManual: false };
  }

  const format = config.format ?? "text";
  const expected = config.expected.map((e) => e.trim()).filter(Boolean);

  if (format === "number") {
    const sNum = parseNumberLoose(student);
    if (sNum == null) {
      return { awardedPoints: 0, isCorrect: false, needsManual: false };
    }
    const tol = config.tolerance ?? 0.01;
    const ok = expected.some((e) => {
      const n = parseNumberLoose(e);
      return n != null && Math.abs(n - sNum) <= Math.max(tol, Math.abs(n) * tol);
    });
    return {
      awardedPoints: ok ? points : 0,
      isCorrect: ok,
      needsManual: false,
    };
  }

  if (format === "fraction") {
    const norm = (v: string) =>
      normalizeComparableText(v).replace(/\s*\/\s*/g, "/");
    const s = norm(student);
    const ok = expected.some((e) => norm(e) === s);
    return {
      awardedPoints: ok ? points : 0,
      isCorrect: ok,
      needsManual: false,
    };
  }

  if (format === "formula" || format === "chemistry") {
    const s = normalizeFormula(student);
    const ok = expected.some((e) => normalizeFormula(e) === s);
    return {
      awardedPoints: ok ? points : 0,
      isCorrect: ok,
      needsManual: false,
    };
  }

  // text
  if (config.caseSensitive) {
    const ok = expected.some((e) => e.trim() === student);
    return {
      awardedPoints: ok ? points : 0,
      isCorrect: ok,
      needsManual: false,
    };
  }
  const s = normalizeComparableText(student);
  const ok = expected.some((e) => normalizeComparableText(e) === s);
  return {
    awardedPoints: ok ? points : 0,
    isCorrect: ok,
    needsManual: false,
  };
}
