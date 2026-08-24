import type { jsPDF } from "jspdf";

import { renderAngolaPrimaryStudyDeclarations } from "@/lib/angola-primary-declaration-render";
import { shouldUseAngolaPrimaryStudyDeclaration } from "@/lib/angola-primary-structure";
import { renderAngolaStudyDeclarations } from "@/lib/angola-study-declaration-render";
import { shouldUseAngolaStudyDeclaration } from "@/lib/angola-secondary-structure";
import type { BulletinBranchContext } from "@/lib/bulletin-context";
import { bulletinLocaleForEducationSystem } from "@/lib/education-system";
import { numberToWords } from "@/lib/number-to-words";

type TermPeriodStudent = {
  nom?: string;
  studentSurname?: string;
  studentusername?: string;
  studentnaissance?: string;
  studentclasse?: string;
  studentSexe?: string;
  fatherName?: string;
  motherName?: string;
  placeOfBirth?: string;
  periods?: Array<{
    periodName: string;
    notes?: Record<string, { score?: number; maxScore?: number }>;
  }>;
};

type TermCopy = {
  republic: string;
  ministry: string;
  title: string;
  declares: string;
  student: string;
  birth: string;
  year: string;
  classLabel: string;
  result: string;
  subjects: string;
  marks: string;
  inWords: string;
  average: string;
  pass: string;
  fail: string;
  director: string;
  deputy: string;
};

const COPY: Record<"pt" | "en", TermCopy> = {
  pt: {
    republic: "REPÚBLICA DE ANGOLA",
    ministry: "MINISTÉRIO DA EDUCAÇÃO",
    title: "BOLETIM DO TRIMESTRE",
    declares:
      "A direcção do estabelecimento declara que o(a) aluno(a) obteve as seguintes classificações neste período lectivo.",
    student: "Aluno(a)",
    birth: "Nascimento",
    year: "Ano lectivo",
    classLabel: "Classe",
    result: "Resultado",
    subjects: "DISCIPLINAS",
    marks: "NOTAS",
    inWords: "POR EXTENSO",
    average: "MÉDIA GERAL",
    pass: "Transita",
    fail: "Não transita",
    director: "A Directora",
    deputy: "O Subdirector Pedagógico",
  },
  en: {
    republic: "SCHOOL REPORT",
    ministry: "MINISTRY OF EDUCATION",
    title: "TERM REPORT",
    declares:
      "The school administration certifies that the student obtained the following marks for this term.",
    student: "Student",
    birth: "Date of birth",
    year: "Academic year",
    classLabel: "Class",
    result: "Result",
    subjects: "SUBJECTS",
    marks: "MARKS",
    inWords: "IN WORDS",
    average: "OVERALL AVERAGE",
    pass: "Promoted",
    fail: "Not promoted",
    director: "Headteacher",
    deputy: "Deputy Head (Academic)",
  },
};

function formatScore(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function studentFullName(student: TermPeriodStudent): string {
  return [student.nom, student.studentSurname, student.studentusername]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .trim();
}

export function renderTermPeriodBulletins(
  doc: jsPDF,
  params: {
    students: TermPeriodStudent[];
    branchContext: BulletinBranchContext;
    periodLabel: string;
    schoolYear?: string;
    classLabel?: string;
    classLevel?: string | null;
    classParallel?: string | null;
  },
) {
  if (
    shouldUseAngolaPrimaryStudyDeclaration(
      params.branchContext.educationSystem,
      params.branchContext.branchType,
      params.classLevel,
      params.classLabel ?? params.students[0]?.studentclasse,
    )
  ) {
    renderAngolaPrimaryStudyDeclarations(doc, {
      students: params.students,
      branchContext: params.branchContext,
      periodLabel: params.periodLabel,
      schoolYear: params.schoolYear,
      classLabel: params.classLabel,
      classLevel: params.classLevel,
      classParallel: params.classParallel,
    });
    return;
  }

  if (
    shouldUseAngolaStudyDeclaration(
      params.branchContext.educationSystem,
      params.classLevel,
      params.classLabel ?? params.students[0]?.studentclasse,
    )
  ) {
    renderAngolaStudyDeclarations(doc, {
      students: params.students,
      branchContext: params.branchContext,
      periodLabel: params.periodLabel,
      schoolYear: params.schoolYear,
      classLabel: params.classLabel,
      classLevel: params.classLevel,
      classParallel: params.classParallel,
    });
    return;
  }

  const locale = bulletinLocaleForEducationSystem(
    params.branchContext.educationSystem,
  );
  const copy = locale === "en" ? COPY.en : COPY.pt;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  params.students.forEach((student, studentIndex) => {
    if (studentIndex > 0) doc.addPage();

    const period =
      student.periods?.find((item) => item.periodName === params.periodLabel) ??
      student.periods?.[0];
    const subjects = Object.entries(period?.notes ?? {}).filter(
      ([name]) => name.trim().length > 0,
    );

    let scores = 0;
    let maxima = 0;
    for (const [, note] of subjects) {
      const score = Number(note.score);
      const max = Number(note.maxScore);
      if (Number.isFinite(score)) scores += score;
      if (Number.isFinite(max) && max > 0) maxima += max;
    }
    const average = maxima > 0 ? (scores / maxima) * 20 : 0;
    const passed = average >= 10;

    let y = 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(copy.republic, pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(10);
    doc.text(copy.ministry, pageWidth / 2, y, { align: "center" });
    y += 7;
    doc.setFontSize(12);
    const schoolLines = doc.splitTextToSize(
      params.branchContext.branchName,
      pageWidth - margin * 2,
    ) as string[];
    doc.text(schoolLines, pageWidth / 2, y, { align: "center" });
    y += 5 + (schoolLines.length - 1) * 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const location = [params.branchContext.city, params.branchContext.province]
      .filter(Boolean)
      .join(" · ");
    if (location) {
      doc.text(location, pageWidth / 2, y, { align: "center" });
      y += 6;
    }

    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`${copy.title} — ${params.periodLabel}`, pageWidth / 2, y, {
      align: "center",
    });
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const declareLines = doc.splitTextToSize(copy.declares, pageWidth - margin * 2);
    doc.text(declareLines, margin, y);
    y += declareLines.length * 4.5 + 4;

    doc.setFontSize(10);
    doc.text(`${copy.student}: ${studentFullName(student) || "—"}`, margin, y);
    y += 5;
    doc.text(
      `${copy.birth}: ${student.studentnaissance || "—"}    ${copy.classLabel}: ${
        params.classLabel || student.studentclasse || "—"
      }`,
      margin,
      y,
    );
    y += 5;
    doc.text(
      `${copy.year}: ${params.schoolYear || period?.periodName || "—"}    ${copy.result}: ${
        passed ? copy.pass : copy.fail
      }`,
      margin,
      y,
    );
    y += 8;

    const tableWidth = pageWidth - margin * 2;
    const colSubject = tableWidth * 0.52;
    const colMark = tableWidth * 0.16;
    const colWords = tableWidth * 0.32;
    const rowH = 7;

    doc.setFillColor(245, 247, 250);
    doc.rect(margin, y, tableWidth, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(copy.subjects, margin + 2, y + 5);
    doc.text(copy.marks, margin + colSubject + 2, y + 5);
    doc.text(copy.inWords, margin + colSubject + colMark + 2, y + 5);
    y += rowH;
    doc.setFont("helvetica", "normal");

    if (subjects.length === 0) {
      doc.rect(margin, y, tableWidth, rowH);
      doc.text("—", margin + 2, y + 5);
      y += rowH;
    }

    for (const [name, note] of subjects) {
      const score = Number(note.score);
      doc.rect(margin, y, colSubject, rowH);
      doc.rect(margin + colSubject, y, colMark, rowH);
      doc.rect(margin + colSubject + colMark, y, colWords, rowH);
      doc.text(name.slice(0, 42), margin + 2, y + 5);
      doc.text(formatScore(score), margin + colSubject + 2, y + 5);
      doc.text(
        Number.isFinite(score) ? numberToWords(score, locale) : "—",
        margin + colSubject + colMark + 2,
        y + 5,
      );
      y += rowH;
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
    }

    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(
      `${copy.average}: ${formatScore(average)} / 20  (${numberToWords(average, locale)})`,
      margin,
      y,
    );

    y = Math.max(y + 24, 250);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const dateLine = new Date().toLocaleDateString(locale === "pt" ? "pt-AO" : "en-GB");
    doc.text(
      `${params.branchContext.city || params.branchContext.country || ""}, ${dateLine}`,
      margin,
      y,
    );
    y += 22;
    const sigWidth = (pageWidth - margin * 2) / 2;
    doc.line(margin + 8, y, margin + sigWidth - 12, y);
    doc.line(margin + sigWidth + 12, y, pageWidth - margin - 8, y);
    y += 5;
    doc.text(copy.deputy, margin + sigWidth / 2, y, { align: "center" });
    doc.text(copy.director, margin + sigWidth + sigWidth / 2, y, {
      align: "center",
    });
  });
}
