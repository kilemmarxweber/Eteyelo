import type { jsPDF } from "jspdf";

import {
  ANGOLA_SECONDARY_COURSE_CATALOG,
  matchAngolaSecondaryCourse,
} from "@/lib/angola-secondary-course-catalog";
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
  enrollmentNumber?: string;
  biNumber?: string;
  biIssuedAt?: string;
  periods?: DeclarationPeriod[];
  [key: string]: unknown;
};

export type AngolaDeclarationSubjectRow = {
  disciplina: string;
  score: number;
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

function parseDateParts(value?: string): {
  day: number;
  month: number;
  year: number;
} | null {
  if (!value) return null;
  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  };
}

function formatLongPtDate(value?: string): string {
  const parts = parseDateParts(value);
  if (!parts) return "__ de ________ de ______";
  const month = PT_MONTHS[parts.month - 1] ?? "";
  const titled = month.charAt(0) + month.slice(1).toLowerCase();
  return `${String(parts.day).padStart(2, "0")} de ${titled} de ${parts.year}`;
}

export function formatAngolaDeclarationIssueLine(
  school: string,
  issuedAt: Date = new Date(),
  city?: string,
): string {
  const month = PT_MONTHS[issuedAt.getMonth()] ?? "";
  const place = school.trim().toUpperCase() || "________";
  const cityPart = city?.trim().toUpperCase();
  const withCity =
    cityPart && !place.includes(cityPart) ? `${place} EM ${cityPart}` : place;
  const day = String(issuedAt.getDate()).padStart(2, "0");
  return `${withCity}, AO ${day} DE ${month} DE ${issuedAt.getFullYear()}`;
}

export function angolaDeclarationTurma(
  classParallel?: string | null,
  classLabel?: string,
): string {
  const fromParallel = classParallel?.trim().replace(/^turma\s+/i, "");
  if (fromParallel) return fromParallel;
  const match = classLabel?.match(/(?:turma\s+|[\s-])([A-Z])\s*$/i);
  if (match?.[1]) return match[1].toUpperCase();
  return "Única";
}

function optionalStudentField(
  student: DeclarationStudent,
  keys: string[],
): string {
  for (const key of keys) {
    const value = student[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
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

export function buildAngolaStudyDeclarationRows(
  notes: Record<string, SubjectNote>,
): AngolaDeclarationSubjectRow[] {
  const remaining = new Map(
    Object.entries(notes).filter(([name]) => name.trim().length > 0),
  );
  const rows: AngolaDeclarationSubjectRow[] = [];

  for (const entry of ANGOLA_SECONDARY_COURSE_CATALOG) {
    let foundKey: string | undefined;
    for (const [name] of remaining) {
      const match = matchAngolaSecondaryCourse(name);
      if (match?.codeCours === entry.codeCours) {
        foundKey = name;
        break;
      }
    }
    const note = foundKey ? remaining.get(foundKey) : undefined;
    if (foundKey) remaining.delete(foundKey);
    rows.push({
      disciplina: entry.declarationLabel,
      score: note ? subjectScore(note) : Number.NaN,
    });
  }

  for (const [name, note] of remaining) {
    rows.push({
      disciplina: name.trim().toUpperCase(),
      score: subjectScore(note),
    });
  }

  return rows;
}

function scoreCell(score: number): { mark: string; words: string } {
  if (!Number.isFinite(score)) {
    return { mark: "( )", words: "( )" };
  }
  return {
    mark: formatScore(score),
    words: `(${numberToWords(Math.round(score), "pt")})`,
  };
}

function drawSubjectTable(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  rows: AngolaDeclarationSubjectRow[],
): number {
  const colDisciplina = width * 0.5;
  const colMedia = width * 0.16;
  const colWords = width - colDisciplina - colMedia;
  const headerH = 6.2;
  const rowH = Math.min(5.35, rows.length > 16 ? 4.7 : 5.35);

  const drawRow = (
    top: number,
    height: number,
    disciplina: string,
    media: string,
    words: string,
    header: boolean,
  ) => {
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.28);
    doc.rect(x, top, width, height);
    doc.line(x + colDisciplina, top, x + colDisciplina, top + height);
    doc.line(
      x + colDisciplina + colMedia,
      top,
      x + colDisciplina + colMedia,
      top + height,
    );
    doc.setFont("helvetica", header ? "bold" : "normal");
    doc.setFontSize(header ? 8.2 : 8);
    doc.setTextColor(...INK);
    const textY = top + height * 0.68;
    doc.text(disciplina, x + 1.6, textY);
    doc.setTextColor(...(header ? INK : HIGHLIGHT));
    doc.text(media, x + colDisciplina + colMedia / 2, textY, {
      align: "center",
    });
    doc.text(words, x + colDisciplina + colMedia + colWords / 2, textY, {
      align: "center",
    });
    doc.setTextColor(...INK);
  };

  drawRow(y, headerH, "DISCIPLINA", "MÉDIA", "POR EXTENSO", true);
  let cursor = y + headerH;
  for (const row of rows) {
    const cell = scoreCell(row.score);
    drawRow(cursor, rowH, row.disciplina, cell.mark, cell.words, false);
    cursor += rowH;
  }
  return cursor;
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
  const school = angolaDeclarationSchoolLabel(
    params.branchContext.branchName,
    params.branchContext.branchCode,
  );
  const province = params.branchContext.province.trim();
  const city = params.branchContext.city.trim();
  const municipality = params.branchContext.commune.trim() || city;
  const directorName = params.branchContext.directorName?.trim() ?? "";
  const directorTitle =
    params.branchContext.directorTitle?.trim() || "Directora";
  const classPhrase = angolaStudyDeclarationClassPhrase(
    params.classLevel || params.classLabel,
  );
  const turma = angolaDeclarationTurma(
    params.classParallel,
    params.classLabel || params.classLevel || "",
  );
  const year = params.schoolYear?.trim() || "________";
  const branchCode = params.branchContext.branchCode.trim();

  params.students.forEach((student, index) => {
    if (index > 0) doc.addPage();

    const periods = studentPeriods(student);
    const period =
      periods.find((item) => periodLabelOf(item) === params.periodLabel) ??
      periods[0];
    const rows = buildAngolaStudyDeclarationRows(
      period ? periodNotes(period) : {},
    );
    const scores = rows
      .map((row) => row.score)
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
    const enrollment =
      optionalStudentField(student, ["enrollmentNumber", "numero", "nInscricao"]) ||
      "____";
    const biNumber =
      optionalStudentField(student, ["biNumber", "identityDocument", "bi"]) ||
      "________";
    const biIssuedRaw = optionalStudentField(student, [
      "biIssuedAt",
      "biIssueDate",
    ]);
    const biIssuedAt = biIssuedRaw
      ? formatLongPtDate(biIssuedRaw)
      : "________";
    const processNumber = branchCode
      ? `${branchCode}/${enrollment}/${year}`
      : "________";

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
      "SECRETARIA PROVINCIAL DA EDUCAÇÃO, CIÊNCIA E TECNOLOGIA",
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

    y += 9;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.4);
    const cityClause = city ? `, em ${city}` : "";
    y = drawRuns(
      doc,
      [
        { text: directorName || "________", highlight: true },
        { text: `, ${directorTitle} do ` },
        { text: school, highlight: true },
        { text: `${cityClause}, Declaro que, ` },
        { text: fullName, highlight: true },
        { text: female ? ", Filha de " : ", Filho de " },
        { text: fatherName, highlight: true },
        { text: " e de " },
        { text: motherName, highlight: true },
        { text: female ? ", nascida aos " : ", nascido aos " },
        { text: formatLongPtDate(student.studentnaissance), highlight: true },
        { text: ", Natural de " },
        { text: birthPlace, highlight: true },
        { text: ", Município de " },
        { text: municipality || "________", highlight: true },
        { text: ", Província de " },
        { text: province || "________", highlight: true },
        {
          text: female
            ? `, Portadora de BI Nº ${biNumber}, emitido aos ${biIssuedAt}, pelo Arquivo de Identificação de ${city || "________"}.`
            : `, Portador de BI Nº ${biNumber}, emitido aos ${biIssuedAt}, pelo Arquivo de Identificação de ${city || "________"}.`,
        },
      ],
      innerLeft,
      y,
      textWidth,
      4.85,
    );

    y += 2.2;
    y = drawRuns(
      doc,
      [
        { text: "Frequentou este Estabelecimento de Ensino no ano Lectivo de " },
        { text: year, highlight: true },
        { text: ", sob nº " },
        { text: enrollment, highlight: true },
        { text: ", turma " },
        { text: turma, highlight: true },
        { text: ", no qual concluiu a " },
        { text: classPhrase, highlight: true },
        { text: " com o Resultado Final " },
        { text: passed ? "Transita" : "Não transita", highlight: true },
        {
          text: ", tendo obtido as seguintes médias nas matérias professadas no respectivo ano neste ",
        },
        { text: school, highlight: true },
        { text: ":" },
      ],
      innerLeft,
      y,
      textWidth,
      4.85,
    );

    y += 3.2;
    y = drawSubjectTable(doc, innerLeft, y, textWidth, rows);

    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.2);
    doc.setTextColor(...INK);
    doc.text("Valores respectivamente.", innerLeft, y);

    y += 5.4;
    const averageWords = Number.isFinite(average)
      ? numberToWords(Math.round(average), "pt")
      : "________";
    y = drawRuns(
      doc,
      [
        { text: "MÉDIA GERAL DE " },
        {
          text: `${formatScore(average)} (${averageWords})`,
          highlight: true,
        },
        {
          text: ` Valores conforme consta na respectiva pauta e termo de matrícula, processo nº ${processNumber} arquivados nesta Escola.`,
        },
      ],
      innerLeft,
      y,
      textWidth,
      4.7,
    );

    y += 3.2;
    const legal = doc.splitTextToSize(
      "Por ser verdade e me ter sido requerido, mandei passar a presente DECLARAÇÃO DE ESTUDO que confiro, assino e vai autenticada com o carimbo a óleo em uso neste Estabelecimento de Ensino.",
      textWidth,
    );
    doc.text(legal, innerLeft, y);
    y += legal.length * 4.5 + 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.6);
    const issueLines = doc.splitTextToSize(
      formatAngolaDeclarationIssueLine(school, new Date(), city),
      textWidth,
    ) as string[];
    doc.text(issueLines, pageWidth / 2, y, { align: "center" });

    y = Math.max(y + 18 + (issueLines.length - 1) * 4, pageHeight - 38);
    const sigMid = (innerLeft + innerRight) / 2;
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.3);
    doc.line(sigMid - 38, y, sigMid + 38, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const article = /a$/i.test(directorTitle) ? "A" : "O";
    doc.text(
      `${article} ${directorTitle} da Escola`,
      sigMid,
      y,
      { align: "center" },
    );
    if (directorName) {
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...HIGHLIGHT);
      doc.text(directorName, sigMid, y, { align: "center" });
      doc.setTextColor(...INK);
    }
  });
}
