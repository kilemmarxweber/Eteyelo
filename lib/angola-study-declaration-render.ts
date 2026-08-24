import type { jsPDF } from "jspdf";

import {
  angolaStudyDeclarationClassPhrase,
  shouldUseAngolaStudyDeclaration,
} from "@/lib/angola-secondary-structure";
import type { BulletinBranchContext } from "@/lib/bulletin-context";
import { numberToWords } from "@/lib/number-to-words";
import {
  angolaDeclarationSchoolLabel,
  declarationBlankName,
} from "@/lib/person-full-name";

export { shouldUseAngolaStudyDeclaration };

const HIGHLIGHT: [number, number, number] = [176, 36, 68];
const INK: [number, number, number] = [20, 20, 20];
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

type TextRun = { text: string; highlight?: boolean };

export type AngolaStudyDeclarationParams = {
  students: DeclarationStudent[];
  branchContext: BulletinBranchContext;
  periodLabel: string;
  schoolYear?: string;
  classLabel?: string;
  classLevel?: string | null;
  classParallel?: string | null;
};

function isFemale(sex?: string): boolean {
  return /^(f|fem|female|feminino|féminin)/i.test((sex ?? "").trim());
}

function studentFullName(student: DeclarationStudent): string {
  const parts = [student.nom, student.studentSurname, student.studentusername]
    .filter((part) => typeof part === "string" && part.trim())
    .map((part) => part!.trim());
  return [...new Set(parts)].join(" ").trim() || "________________";
}

function formatScore(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatLongPtDate(value?: string): string {
  if (!value) return "___ de ________ de ______";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "___ de ________ de ______";
  const month = PT_MONTHS[date.getMonth()] ?? "";
  const titled = month.charAt(0) + month.slice(1).toLowerCase();
  return `${date.getDate()} de ${titled} de ${date.getFullYear()}`;
}

function formatIssuePlaceDate(city: string, school: string): string {
  const now = new Date();
  const month = PT_MONTHS[now.getMonth()] ?? "";
  const place = (city.trim() || school).toUpperCase();
  return `${place}, AOS ${now.getDate()} DE ${month} DE ${now.getFullYear()}`;
}

function extractTurma(
  classParallel?: string | null,
  classLabel?: string,
): string {
  const fromParallel = classParallel?.trim();
  if (fromParallel) return fromParallel.replace(/^turma\s+/i, "").toUpperCase();
  const match = classLabel?.match(/(?:turma\s+)?([A-Z])\s*$/i);
  return match?.[1]?.toUpperCase() ?? "____";
}

function subjectScore(note: SubjectNote): number {
  const score = Number(note.score);
  const max = Number(
    note.maxScore ?? (note as { maxScore?: number }).maxScore,
  );
  if (!Number.isFinite(score)) return Number.NaN;
  if (Number.isFinite(max) && max > 0 && Math.abs(max - 20) > 0.01) {
    return (score / max) * 20;
  }
  return score;
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
      words.push({ text: piece, highlight: run.highlight });
    }
  }

  let line: TextRun[] = [];
  let lineWidth = 0;
  let cursorY = y;

  const flush = () => {
    let cursorX = x;
    for (const word of line) {
      doc.setTextColor(...(word.highlight ? HIGHLIGHT : INK));
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
  doc.setTextColor(...INK);
  return cursorY;
}

function drawSubjectCell(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  name: string,
  score: number,
) {
  const mark = Number.isFinite(score) ? formatScore(score) : "—";
  const words = Number.isFinite(score)
    ? numberToWords(Math.round(score), "pt")
    : "—";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.4);
  doc.setTextColor(...INK);
  doc.text(name.toUpperCase().slice(0, 18), x, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...HIGHLIGHT);
  doc.text(`${mark}  (${words})`, x + width, y, { align: "right" });
  doc.setTextColor(...INK);
}

export function renderAngolaStudyDeclarations(
  doc: jsPDF,
  params: AngolaStudyDeclarationParams,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const innerLeft = 18;
  const innerRight = pageWidth - 18;
  const textWidth = innerRight - innerLeft;
  const school = params.branchContext.branchName.trim() || "________________";
  const schoolLabel = angolaDeclarationSchoolLabel(
    params.branchContext.branchName,
    params.branchContext.branchCode,
  );
  const province = params.branchContext.province.trim();
  const city = params.branchContext.city.trim();
  const directorName = params.branchContext.directorName?.trim() ?? "";
  const directorTitle = "Directora";
  const classPhrase = angolaStudyDeclarationClassPhrase(
    params.classLevel || params.classLabel,
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
    const scores = subjects
      .map(([, note]) => subjectScore(note))
      .filter((value) => Number.isFinite(value));
    const average =
      scores.length > 0
        ? scores.reduce((sum, value) => sum + value, 0) / scores.length
        : 0;
    const passed = average >= 10;
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

    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    y = drawRuns(
      doc,
      [
        { text: directorName || "________", highlight: true },
        { text: ", Directora do " },
        { text: schoolLabel, highlight: true },
        { text: ", declara para os devidos efeitos que " },
        { text: fullName, highlight: true },
        { text: female ? ", filha de " : ", filho de " },
        { text: fatherName, highlight: true },
        { text: " e de " },
        { text: motherName, highlight: true },
        {
          text: female ? ", nascida aos " : ", nascido aos ",
        },
        { text: formatLongPtDate(student.studentnaissance), highlight: true },
        {
          text: `, no Município de ${birthPlace}, Província de ${province || "________"}, frequentou neste Estabelecimento de Ensino, no ano lectivo `,
        },
        { text: year, highlight: true },
        { text: ", com o n.º ____ da turma " },
        { text: turma, highlight: true },
        { text: ", a " },
        { text: classPhrase, highlight: true },
        { text: ", cujo Resultado Final " },
        { text: passed ? "Transita" : "Não transita", highlight: true },
        { text: ", com as seguintes classificações:" },
      ],
      innerLeft,
      y,
      textWidth,
      5.1,
    );

    y += 4;
    const colGap = 8;
    const colWidth = (textWidth - colGap) / 2;
    const mid = Math.ceil(subjects.length / 2) || 1;
    const leftSubjects = subjects.slice(0, mid);
    const rightSubjects = subjects.slice(mid);
    const rows = Math.max(leftSubjects.length, rightSubjects.length, 1);

    for (let row = 0; row < rows; row += 1) {
      const leftItem = leftSubjects[row];
      const rightItem = rightSubjects[row];
      if (leftItem) {
        drawSubjectCell(
          doc,
          innerLeft,
          y,
          colWidth,
          leftItem[0],
          subjectScore(leftItem[1]),
        );
      }
      if (rightItem) {
        drawSubjectCell(
          doc,
          innerLeft + colWidth + colGap,
          y,
          colWidth,
          rightItem[0],
          subjectScore(rightItem[1]),
        );
      }
      y += 5.6;
    }

    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text("MÉDIA GERAL DE ", innerLeft, y);
    const prefixW = doc.getTextWidth("MÉDIA GERAL DE ");
    doc.setTextColor(...HIGHLIGHT);
    doc.text(`${formatScore(average)} Valores`, innerLeft + prefixW, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    y += 6;
    const closing = doc.splitTextToSize(
      "conforme consta na respectiva pauta e termo de matrícula, processo n.º ________ arquivados nesta Escola.",
      textWidth,
    );
    doc.text(closing, innerLeft, y);
    y += closing.length * 4.6 + 6;

    const legal = doc.splitTextToSize(
      "Por ser verdade e me ter sido solicitada, mandei passar a presente Declaração que vai por mim assinada e autenticada com o carimbo a óleo em uso nesta Escola.",
      textWidth,
    );
    doc.text(legal, innerLeft, y);
    y += legal.length * 4.8 + 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(formatIssuePlaceDate(city, school), pageWidth / 2, y, {
      align: "center",
    });

    y = Math.max(y + 22, pageHeight - 42);
    const sigWidth = textWidth / 2;
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.3);
    doc.line(innerLeft + 6, y, innerLeft + sigWidth - 10, y);
    doc.line(innerLeft + sigWidth + 10, y, innerRight - 6, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("O Subdirector Pedagógico", innerLeft + sigWidth / 2, y, {
      align: "center",
    });
    doc.text(`A ${directorTitle} da Escola`, innerLeft + sigWidth + sigWidth / 2, y, {
      align: "center",
    });
    if (directorName) {
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...HIGHLIGHT);
      doc.text(directorName, innerLeft + sigWidth + sigWidth / 2, y, {
        align: "center",
      });
      doc.setTextColor(...INK);
    }
  });
}
