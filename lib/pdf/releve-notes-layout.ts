import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import type { ReleveNotesData } from "@/lib/releve-notes-builder";
import {
  downloadPdfOutput,
  finalizePdfDocument,
  formatFrenchDate,
  safePdfFilePart,
  type PdfOutput,
} from "@/lib/pdf/pdf-engine";

export type ReleveNotesPdfInput = ReleveNotesData & {
  organizationName: string;
  branchName: string;
  releveNumber: string;
  issuedAt?: Date;
};

export function buildReleveNotesPdfDoc(input: ReleveNotesPdfInput) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const issuedAt = input.issuedAt ?? new Date();
  const dateLabel = formatFrenchDate(issuedAt);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(input.organizationName, pageWidth / 2, 18, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(input.branchName, pageWidth / 2, 25, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 64, 175);
  doc.text("RELEVE DE NOTES", pageWidth / 2, 36, { align: "center" });

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const infoLines = [
    `Etudiant : ${input.studentName}`,
    input.username ? `Matricule : ${input.username}` : null,
    input.faculteName ? `Faculte : ${input.faculteName}` : null,
    input.filiereName ? `Filiere : ${input.filiereName}` : null,
    `Auditoire : ${input.auditoireName}`,
    `Annee academique : ${input.schoolYearName}`,
    `Numero : ${input.releveNumber}`,
  ].filter(Boolean) as string[];

  let y = 44;
  for (const line of infoLines) {
    doc.text(line, 14, y);
    y += 5;
  }

  let tableY = y + 4;

  for (const semester of input.semesters) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(semester.semesterLabel, 14, tableY);
    tableY += 4;

    autoTable(doc, {
      startY: tableY,
      head: [["Code UE", "Intitule", "Credits", "Note", "Max", "%"]],
      body: semester.courses.map((course) => [
        course.courseCode,
        course.courseName,
        String(course.credits),
        course.score.toFixed(2),
        course.maxScore.toFixed(2),
        `${course.percentage.toFixed(1)}%`,
      ]),
      foot: [
        [
          "",
          "Moyenne semestrielle",
          "",
          "",
          "",
          `${semester.semesterAverage.toFixed(2)}%`,
        ],
      ],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 64, 175] },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: "bold",
      },
      margin: { left: 14, right: 14 },
    });

    tableY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY
      ? (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable!
          .finalY + 8
      : tableY + 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Moyenne generale : ${input.overallAverage.toFixed(2)}%`, 14, tableY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Delivre le ${dateLabel}`, 14, tableY + 8);
  doc.text("Le secretaire academique", 14, tableY + 24);
  doc.text("Le doyen / directeur", pageWidth - 14, tableY + 24, { align: "right" });

  return doc;
}

export function createReleveNotesPdfOutput(input: ReleveNotesPdfInput): PdfOutput {
  const fileName = `releve-${safePdfFilePart(input.releveNumber || input.studentName)}.pdf`;
  return finalizePdfDocument(buildReleveNotesPdfDoc(input), fileName);
}

export function generateReleveNotesPdf(input: ReleveNotesPdfInput) {
  downloadPdfOutput(createReleveNotesPdfOutput(input));
}
