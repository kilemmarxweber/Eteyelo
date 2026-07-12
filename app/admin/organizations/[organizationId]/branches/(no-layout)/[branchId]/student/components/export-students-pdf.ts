import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { IStudent } from "@/src/interfaces/Student";

export type StudentReportContext = {
  branchName: string;
  organizationName: string;
  schoolYearName: string;
  logoUrl: string;
};

export type StudentReportOptions = {
  selectedClass?: { code: string; name: string } | null;
};

function ageFromBirthDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return "-";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age -= 1;
  }
  return age >= 0 ? String(age) : "-";
}

function formatBirthDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function imageUrlToDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawReportHeader(
  doc: jsPDF,
  context: StudentReportContext,
  title: string,
  studentCount: number,
  logo: string | null,
) {
  const pageWidth = doc.internal.pageSize.getWidth();

  if (logo) {
    try {
      doc.addImage(logo, 12, 8, 18, 18);
    } catch {
      // Un logo invalide ne doit pas empecher la production du rapport.
    }
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(context.organizationName || "Eteyelo", pageWidth / 2, 10, {
    align: "center",
  });
  doc.setFontSize(11);
  doc.text(context.branchName, pageWidth / 2, 16, { align: "center" });

  doc.setTextColor(30, 64, 175);
  doc.setFontSize(15);
  doc.text(title, pageWidth / 2, 24, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8);
  const details = [
    context.schoolYearName ? `Annee scolaire : ${context.schoolYearName}` : "",
    `${studentCount} eleve(s)`,
    `Genere le ${new Date().toLocaleString("fr-FR")}`,
  ]
    .filter(Boolean)
    .join("  |  ");
  doc.text(details, pageWidth / 2, 30, { align: "center" });
  doc.setDrawColor(191, 219, 254);
  doc.line(10, 33, pageWidth - 10, 33);
}

export async function buildStudentsReportPdf(
  students: IStudent[],
  context: StudentReportContext,
  options: StudentReportOptions = {},
) {
  const selectedClass = options.selectedClass ?? null;
  const isClassReport = Boolean(selectedClass);
  const title = isClassReport
    ? `Liste des eleves de la classe ${selectedClass?.name}`
    : "Liste globale de tous les eleves";
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);

  const globalHead = [
    "#",
    "Matricule",
    "Nom",
    "Postnom",
    "Prenom",
    "Sexe",
    "Lieu de naissance",
    "Date de naissance",
    "Age",
    "Classe",
  ];
  const classHead = ["#", "Matricule", "Nom", "Postnom", "Prenom", "Sexe"];

  const globalBody = students.map((student, index) => [
    index + 1,
    student.username || "-",
    student.nom || "-",
    student.postnom || "-",
    student.prenom || "-",
    student.sexe || "-",
    student.placeOfBirth || "-",
    formatBirthDate(student.dateOfBirth),
    ageFromBirthDate(student.dateOfBirth),
    student.className || "Non affecte",
  ]);
  const classBody = students.map((student, index) => [
    index + 1,
    student.username || "-",
    student.nom || "-",
    student.postnom || "-",
    student.prenom || "-",
    student.sexe || "-",
  ]);

  autoTable(doc, {
    startY: 37,
    margin: { top: 37, right: 10, bottom: 14, left: 10 },
    head: [isClassReport ? classHead : globalHead],
    body: isClassReport ? classBody : globalBody,
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: isClassReport ? 9 : 7.2,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    columnStyles: isClassReport
      ? {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 42 },
          2: { cellWidth: 54 },
          3: { cellWidth: 54 },
          4: { cellWidth: 54 },
          5: { cellWidth: 22, halign: "center" },
        }
      : {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 27 },
          2: { cellWidth: 31 },
          3: { cellWidth: 31 },
          4: { cellWidth: 31 },
          5: { cellWidth: 13, halign: "center" },
          6: { cellWidth: 35 },
          7: { cellWidth: 28, halign: "center" },
          8: { cellWidth: 11, halign: "center" },
          9: { cellWidth: 42 },
        },
    didDrawPage: () => {
      drawReportHeader(doc, context, title, students.length, logo);
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100);
      doc.text(context.branchName, 10, pageHeight - 6);
    },
  });

  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7.5);
    doc.setTextColor(100);
    doc.text(`Page ${page} / ${totalPages}`, pageWidth - 10, pageHeight - 6, {
      align: "right",
    });
  }

  return doc;
}

export async function exportStudentsReportPdf(
  students: IStudent[],
  context: StudentReportContext,
  options: StudentReportOptions = {},
) {
  const date = new Date().toISOString().slice(0, 10);
  const selectedClass = options.selectedClass ?? null;
  const reportName = selectedClass
    ? `liste-eleves-${safeFilePart(selectedClass.name)}`
    : "liste-globale-eleves";
  const doc = await buildStudentsReportPdf(students, context, options);
  doc.save(`${reportName}-${date}.pdf`);
}
