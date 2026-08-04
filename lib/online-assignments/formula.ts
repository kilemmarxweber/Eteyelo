import katex from "katex";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * MathML natif du navigateur — les radicaux √ s’affichent sans dépendre
 * du SVG KaTeX (cassé par le preflight Tailwind).
 */
function renderTex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex.trim(), {
      throwOnError: false,
      displayMode,
      strict: "ignore",
      output: "mathml",
    });
  } catch {
    return `<code>${escapeHtml(tex)}</code>`;
  }
}

/**
 * Extrait et rend les segments `$...$` / `$$...$$` en MathML.
 * Le texte hors formules (y compris √ unicode) est échappé tel quel.
 */
export function renderFormulaHtml(source: string): string {
  if (!source) return "";

  type Part =
    | { type: "text"; value: string }
    | { type: "math"; value: string; display: boolean };

  const parts: Part[] = [];
  const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: source.slice(lastIndex, match.index) });
    }
    if (match[1] != null) {
      parts.push({ type: "math", value: match[1], display: true });
    } else {
      parts.push({ type: "math", value: match[2], display: false });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < source.length) {
    parts.push({ type: "text", value: source.slice(lastIndex) });
  }

  if (parts.length === 0) {
    return escapeHtml(source);
  }

  return parts
    .map((part) =>
      part.type === "text"
        ? escapeHtml(part.value)
        : renderTex(part.value, part.display),
    )
    .join("");
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
