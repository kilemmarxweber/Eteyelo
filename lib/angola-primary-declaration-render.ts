import type { jsPDF } from "jspdf";

import {
  angolaPrimaryLevelLabel,
  extractAngolaPrimaryLevelFromLabel,
} from "@/lib/angola-primary-structure";
import type { BulletinBranchContext } from "@/lib/bulletin-context";
import { numberToWords } from "@/lib/number-to-words";
import { declarationBlankName } from "@/lib/person-full-name";

const HIGHLIGHT: [number, number, number] = [176, 36, 68];
const INK: [number, number, number] = [20, 20, 20];
const ACCENT: [number, number, number] = [176, 28, 28];
const PT_MONTHS = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

type SubjectNote = { score?: number; maxScore?: number };
type DeclarationPeriod = Record<string, unknown> & {
  periodName?: string;
  notes?: Record<string, SubjectNote>;
};
type DeclarationStudent = {
  nom?: string;
  studentSurname?: string;
  studentusername?: string;
  studentnaissance?: string;
  studentclasse?: string;
  studentSexe?: string;
  fatherName?: string;
  motherName?: string;
  placeOfBirth?: string;
  periods?: DeclarationPeriod[];
  [key: string]: unknown;
};
type TextRun = { text: string; highlight?: boolean; accent?: boolean };

export type AngolaPrimaryDeclarationParams = {
  students: DeclarationStudent[];
  branchContext: BulletinBranchContext;
  periodLabel: string;
  schoolYear?: string;
  classLabel?: string;
  classLevel?: string | null;
  classParallel?: string | null;
};

const PRIMARY_COLUMNS: Array<{ header: string; aliases: string[] }> = [
  {
    header: "L. Port",
    aliases: [
      "lingua portuguesa",
      "l. port",
      "portugues",
      "portugais",
      "francais",
      "langue francaise",
    ],
  },
  {
    header: "Mat.",
    aliases: ["matematica", "mathematique", "mathematiques", "math"],
  },
  {
    header: "E. Meio",
    aliases: [
      "estudo do meio",
      "e. meio",
      "estudos do meio",
      "environnement",
      "sciences",
    ],
  },
  {
    header: "E.M.P",
    aliases: [
      "educacao manual",
      "educacao plastica",
      "educacao visual",
      "emp",
      "e.m.p",
      "arts plastiques",
      "education artistique",
    ],
  },
  {
    header: "E. Mus",
    aliases: ["educacao musical", "musica", "musique", "e. mus"],
  },
  {
    header: "E. Fis",
    aliases: [
      "educacao fisica",
      "education physique",
      "eps",
      "e. fis",
      "sport",
    ],
  },
];

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isFemale(sex?: string): boolean {
  return /^(f|fem|female|feminino|féminin)/i.test((sex ?? "").trim());
}

function studentFullName(student: DeclarationStudent): string {
  const parts = [student.nom, student.studentSurname, student.studentusername]
    .filter((part) => typeof part === "string" && part.trim())
    .map((part) => part!.trim());
  return [...new Set(parts)].join(" ").trim() || "________________";
}

function formatLongPtDate(value?: string): string {
  if (!value) return "___ de ________ de ______";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "___ de ________ de ______";
  const month = PT_MONTHS[date.getMonth()] ?? "";
  const titled = month.charAt(0) + month.slice(1).toLowerCase();
  return `${date.getDate()} de ${titled} de ${date.getFullYear()}`;
}

function formatIssuePlaceDate(city: string): string {
  const now = new Date();
  const month = PT_MONTHS[now.getMonth()] ?? "";
  const titled = month.charAt(0) + month.slice(1).toLowerCase();
  const place = city.trim() || "________";
  return `${place}, ao ${now.getDate()} de ${titled} de ${now.getFullYear()}`;
}

function extractTurma(
  classParallel?: string | null,
  classLabel?: string,
): string {
  const fromParallel = classParallel?.trim();
  if (fromParallel) return fromParallel.replace(/^turma\s+/i, "");
  const match = classLabel?.match(/(?:turma\s+)?([A-Z])\s*$/i);
  return match?.[1]?.toUpperCase() ?? "Única";
}

function primaryScore(note: SubjectNote): number {
  const score = Number(note.score);
  const max = Number(note.maxScore);
  if (!Number.isFinite(score)) return Number.NaN;
  if (Number.isFinite(max) && max > 0) {
    if (Math.abs(max - 10) < 0.05) return score;
    return (score / max) * 10;
  }
  if (score <= 10) return score;
  if (score <= 20) return score / 2;
  return score;
}

function formatPrimaryMark(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  return String(Math.max(0, Math.min(10, rounded))).padStart(2, "0");
}

function studentPeriods(student: DeclarationStudent): DeclarationPeriod[] {
  const value = student.periods ?? student["periods"];
  return Array.isArray(value) ? (value as DeclarationPeriod[]) : [];
}

function periodLabelOf(period: DeclarationPeriod): string {
  const value = period.periodName ?? period["periodName"];
  return typeof value === "string" ? value : "";
}

function periodNotes(period: DeclarationPeriod): Record<string, SubjectNote> {
  const value = period.notes ?? period["notes"];
  return value && typeof value === "object"
    ? (value as Record<string, SubjectNote>)
    : {};
}

export function mapAngolaPrimaryGrades(
  subjects: Array<[string, SubjectNote]>,
): Array<{ header: string; score: number }> {
  const remaining = [...subjects];
  const mapped: Array<{ header: string; score: number }> = [];

  for (const column of PRIMARY_COLUMNS) {
    const index = remaining.findIndex(([name]) => {
      const folded = fold(name);
      return column.aliases.some(
        (alias) => folded.includes(alias) || alias.includes(folded),
      );
    });
    if (index >= 0) {
      const [, note] = remaining.splice(index, 1)[0];
      mapped.push({ header: column.header, score: primaryScore(note) });
    } else {
      mapped.push({ header: column.header, score: Number.NaN });
    }
  }

  for (const [name, note] of remaining) {
    const empty = mapped.find((item) => !Number.isFinite(item.score));
    if (empty) {
      empty.header = name.slice(0, 10);
      empty.score = primaryScore(note);
    }
  }

  return mapped;
}

function drawPageFrame(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const stripes: Array<{ color: [number, number, number]; width: number }> = [
    { color: [28, 22, 92], width: 2.8 },
    { color: [18, 148, 154], width: 1.05 },
    { color: [168, 28, 92], width: 0.9 },
  ];
  const margin = 5.2;
  const gap = 0.32;
  let inset = margin;
  for (const stripe of stripes) {
    doc.setFillColor(...stripe.color);
    const spanX = pageWidth - inset * 2;
    const spanY = pageHeight - inset * 2;
    doc.rect(inset, inset, spanX, stripe.width, "F");
    doc.rect(inset, inset + spanY - stripe.width, spanX, stripe.width, "F");
    doc.rect(inset, inset, stripe.width, spanY, "F");
    doc.rect(inset + spanX - stripe.width, inset, stripe.width, spanY, "F");
    inset += stripe.width + gap;
  }
}

function drawCoatOfArms(doc: jsPDF, cx: number, cy: number) {
  doc.setFillColor(206, 17, 38);
  doc.circle(cx, cy, 8.6, "F");
  doc.setFillColor(255, 205, 0);
  doc.circle(cx, cy, 7.1, "F");
  doc.setFillColor(0, 0, 0);
  doc.circle(cx, cy, 5.4, "F");
  doc.setFillColor(255, 205, 0);
  doc.circle(cx, cy, 1.15, "F");
  doc.setDrawColor(255, 205, 0);
  doc.setLineWidth(0.45);
  doc.line(cx - 3.4, cy + 1.4, cx + 3.4, cy + 1.4);
  doc.line(cx - 2.6, cy + 2.6, cx + 2.2, cy - 0.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.2);
  doc.setTextColor(255, 205, 0);
  doc.text("REPÚBLICA DE ANGOLA", cx, cy + 11.2, { align: "center" });
  doc.setTextColor(...INK);
}

function drawRuns(
  doc: jsPDF,
  runs: TextRun[],
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words: TextRun[] = [];
  for (const run of runs) {
    for (const piece of run.text.split(/(\s+)/)) {
      if (!piece) continue;
      words.push({
        text: piece,
        highlight: run.highlight,
        accent: run.accent,
      });
    }
  }

  let line: TextRun[] = [];
  let lineWidth = 0;
  let cursorY = y;

  const flush = () => {
    let cursorX = x;
    for (const word of line) {
      if (word.accent) doc.setTextColor(...ACCENT);
      else if (word.highlight) doc.setTextColor(...HIGHLIGHT);
      else doc.setTextColor(...INK);
      doc.setFont(
        "helvetica",
        word.accent || word.highlight ? "bold" : "normal",
      );
      doc.text(word.text, cursorX, cursorY);
      cursorX += doc.getTextWidth(word.text);
    }
    cursorY += lineHeight;
    line = [];
    lineWidth = 0;
  };

  for (const word of words) {
    const width = doc.getTextWidth(word.text);
    if (lineWidth + width > maxWidth && line.length > 0) flush();
    line.push(word);
    lineWidth += width;
  }
  if (line.length) flush();
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...INK);
  return cursorY;
}

function drawGradeTable(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  columns: Array<{ header: string; score: number }>,
  average: number,
): number {
  const cells = [...columns, { header: "MÉDIA", score: average }];
  const colW = width / cells.length;
  const rowH = 8;
  const rows = 3;

  doc.setDrawColor(...INK);
  doc.setLineWidth(0.25);
  for (let row = 0; row <= rows; row += 1) {
    doc.line(x, y + row * rowH, x + width, y + row * rowH);
  }
  for (let col = 0; col <= cells.length; col += 1) {
    doc.line(x + col * colW, y, x + col * colW, y + rows * rowH);
  }

  cells.forEach((cell, index) => {
    const cx = x + index * colW + colW / 2;
    const isAverage = cell.header === "MÉDIA";
    doc.setTextColor(...(isAverage ? ACCENT : INK));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    doc.text(cell.header, cx, y + 5.2, { align: "center" });

    const mark = Number.isFinite(cell.score)
      ? formatPrimaryMark(cell.score)
      : "—";
    const words = Number.isFinite(cell.score)
      ? numberToWords(Math.round(cell.score), "pt")
      : "—";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(mark, cx, y + rowH + 5.4, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.text(words, cx, y + rowH * 2 + 5.2, { align: "center" });
  });

  doc.setTextColor(...INK);
  return y + rows * rowH;
}

export function renderAngolaPrimaryStudyDeclarations(
  doc: jsPDF,
  params: AngolaPrimaryDeclarationParams,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const innerLeft = 18;
  const innerRight = pageWidth - 18;
  const textWidth = innerRight - innerLeft;
  const school = params.branchContext.branchName.trim() || "________________";
  const province = params.branchContext.province.trim();
  const city = params.branchContext.city.trim();
  const directorName = params.branchContext.directorName?.trim() || "________";
  const classLevel =
    extractAngolaPrimaryLevelFromLabel(params.classLevel) ||
    extractAngolaPrimaryLevelFromLabel(params.classLabel) ||
    params.classLevel ||
    "";
  const classPhrase = angolaPrimaryLevelLabel(
    classLevel || params.classLabel || "________",
  );
  const turma = extractTurma(
    params.classParallel,
    params.classLabel || params.classLevel || "",
  );
  const year = params.schoolYear?.trim() || "________";

  params.students.forEach((student, index) => {
    if (index > 0) doc.addPage();

    const periods = studentPeriods(student);
    const period =
      periods.find((item) => periodLabelOf(item) === params.periodLabel) ??
      periods[0];
    const subjects = Object.entries(period ? periodNotes(period) : {}).filter(
      ([name]) => name.trim().length > 0,
    );
    const grades = mapAngolaPrimaryGrades(subjects);
    const scored = grades
      .map((item) => item.score)
      .filter((value) => Number.isFinite(value));
    const average =
      scored.length > 0
        ? scored.reduce((sum, value) => sum + value, 0) / scored.length
        : Number.NaN;
    const passed = Number.isFinite(average) && average >= 5;
    const female = isFemale(student.studentSexe);
    const fullName = studentFullName(student);
    const fatherName = declarationBlankName(
      typeof student.fatherName === "string" ? student.fatherName : "",
    );
    const motherName = declarationBlankName(
      typeof student.motherName === "string" ? student.motherName : "",
    );
    const birthPlace =
      (typeof student.placeOfBirth === "string" && student.placeOfBirth.trim()) ||
      city ||
      "________";

    drawPageFrame(doc, pageWidth, pageHeight);
    drawCoatOfArms(doc, pageWidth / 2, 22);

    let y = 36;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text("REPÚBLICA DE ANGOLA", pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.setFontSize(9.5);
    doc.text("MINISTÉRIO DA EDUCAÇÃO", pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.setFontSize(8.2);
    doc.setFont("helvetica", "normal");
    doc.text(
      province
        ? `SECRETARIA PROVINCIAL DA EDUCAÇÃO, CIÊNCIA E TECNOLOGIA — ${province.toUpperCase()}`
        : "SECRETARIA PROVINCIAL DA EDUCAÇÃO, CIÊNCIA E TECNOLOGIA",
      pageWidth / 2,
      y,
      { align: "center" },
    );
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const schoolLines = doc.splitTextToSize(
      school.toUpperCase(),
      textWidth,
    ) as string[];
    doc.text(schoolLines, pageWidth / 2, y, { align: "center" });
    const lastSchoolLine = schoolLines[schoolLines.length - 1] ?? "";
    const schoolWidth = doc.getTextWidth(lastSchoolLine);
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.35);
    const schoolLineY = y + (schoolLines.length - 1) * 4.4;
    doc.line(
      pageWidth / 2 - schoolWidth / 2,
      schoolLineY + 1.1,
      pageWidth / 2 + schoolWidth / 2,
      schoolLineY + 1.1,
    );

    y += 6 + (schoolLines.length - 1) * 4.4;
    doc.setFontSize(14);
    doc.text("DECLARAÇÃO DE ESTUDO", pageWidth / 2, y, { align: "center" });
    const titleWidth = doc.getTextWidth("DECLARAÇÃO DE ESTUDO");
    doc.setLineWidth(0.5);
    doc.line(
      pageWidth / 2 - titleWidth / 2,
      y + 1.4,
      pageWidth / 2 + titleWidth / 2,
      y + 1.4,
    );

    y += 11;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.6);
    y = drawRuns(
      doc,
      [
        { text: "a) " },
        { text: directorName, highlight: true },
        { text: ", Directora da " },
        { text: school, highlight: true },
        { text: " Certifica que, " },
        { text: fullName, accent: true },
        { text: female ? " Filha de " : " Filho de " },
        { text: fatherName, highlight: true },
        { text: " e de " },
        { text: motherName, highlight: true },
        { text: female ? ", nascida aos " : ", nascido aos " },
        { text: formatLongPtDate(student.studentnaissance), highlight: true },
        { text: ", Natural de " },
        { text: birthPlace, highlight: true },
        { text: ", Município de " },
        { text: city || "________", highlight: true },
        { text: ", Província de " },
        { text: province || "________", highlight: true },
        {
          text: female
            ? ", Portadora de BI Nº ________ emitido aos ________."
            : ", Portador de BI Nº ________ emitido aos ________.",
        },
      ],
      innerLeft,
      y,
      textWidth,
      5,
    );

    y += 3;
    y = drawRuns(
      doc,
      [
        { text: "Frequentou a " },
        { text: classPhrase, highlight: true },
        { text: " no " },
        { text: school, highlight: true },
        { text: ", Turma " },
        { text: turma, highlight: true },
        { text: ", Nº ____, no ano Lectivo " },
        { text: year, highlight: true },
        { text: " no qual concluiu com resultado final " },
        { text: passed ? "Transita" : "Não transita", accent: true },
        {
          text: ", tendo obtido até ao final do ano o seguinte rendimento, conforme consta das pautas arquivadas neste estabelecimento de ensino:",
        },
      ],
      innerLeft,
      y,
      textWidth,
      5,
    );

    y += 5;
    y = drawGradeTable(doc, innerLeft, y, textWidth, grades, average);

    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.2);
    doc.setTextColor(...INK);
    const legal1 = doc.splitTextToSize(
      "======== Esta Declaração destina-se para efeitos legais.",
      textWidth,
    );
    doc.text(legal1, innerLeft, y);
    y += legal1.length * 4.6 + 3;
    const legal2 = doc.splitTextToSize(
      "======== Por ser verdade e me ter sido solicitada, mandei passar a presente Declaração que vai por mim assinada e autenticada como carimbo em uso neste estabelecimento de ensino.",
      textWidth,
    );
    doc.text(legal2, innerLeft, y);
    y += legal2.length * 4.8 + 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(formatIssuePlaceDate(city), innerLeft, y);

    y = Math.max(y + 16, pageHeight - 48);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("A Directora da Escola,", pageWidth / 2, y, { align: "center" });
    y += 14;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...HIGHLIGHT);
    doc.text(directorName, pageWidth / 2, y, { align: "center" });
    doc.setTextColor(...INK);
  });
}
