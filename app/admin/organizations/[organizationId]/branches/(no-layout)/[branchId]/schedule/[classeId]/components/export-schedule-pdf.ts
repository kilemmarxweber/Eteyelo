import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ScheduleReportContext = {
  classeName: string;
  classeCode: string;
  creneauName: string;
  branchName: string;
  organizationName: string;
  schoolYearName: string;
  logoUrl: string;
};

export type ScheduleReportEntry = {
  id: string;
  day: string;
  startTime: string;
  courseName: string;
  teacherName: string;
};

type SchedulePdfInput = {
  context: ScheduleReportContext;
  days: string[];
  timeSlots: string[];
  recreationHour: string;
  endTime: string;
  entries: ScheduleReportEntry[];
};

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
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function entriesForCell(entries: ScheduleReportEntry[], day: string, hour: string) {
  return entries.filter((entry) => entry.day === day && entry.startTime === hour);
}

export function findScheduleConflicts(entries: ScheduleReportEntry[]) {
  const counts = new Map<string, ScheduleReportEntry[]>();
  for (const entry of entries) {
    const key = `${entry.day}-${entry.startTime}`;
    counts.set(key, [...(counts.get(key) ?? []), entry]);
  }
  return Array.from(counts.values()).filter((items) => items.length > 1);
}

export async function exportSchedulePdf(input: SchedulePdfInput) {
  const { context, days, timeSlots, recreationHour, endTime, entries } = input;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const logo = await imageUrlToDataUrl(context.logoUrl);

  if (logo) {
    try {
      doc.addImage(logo, 12, 8, 20, 20);
    } catch {
      // Le rapport reste utilisable si le format du logo n'est pas supporte.
    }
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(context.organizationName || "Eteyelo", pageWidth / 2, 11, { align: "center" });
  doc.setFontSize(12);
  doc.text(context.branchName, pageWidth / 2, 17, { align: "center" });
  doc.setTextColor(30, 64, 175);
  doc.setFontSize(16);
  doc.text(`Horaire de la classe ${context.classeName}`, pageWidth / 2, 26, { align: "center" });
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const details = [
    context.schoolYearName ? `Annee scolaire : ${context.schoolYearName}` : "",
    context.creneauName ? `Vacation : ${context.creneauName}` : "",
    context.classeCode ? `Code : ${context.classeCode}` : "",
  ].filter(Boolean).join("  |  ");
  doc.text(details, pageWidth / 2, 31, { align: "center" });

  const body = timeSlots.map((hour, index) => {
    const nextTime = timeSlots[index + 1] || endTime;
    if (hour === recreationHour) {
      return [
        `${hour} - ${nextTime}`,
        ...days.map(() => "RECREATION"),
      ];
    }

    return [
      `${hour} - ${nextTime}`,
      ...days.map((day) => {
        const cellEntries = entriesForCell(entries, day, hour);
        if (!cellEntries.length) return "-";
        const content = cellEntries.map((entry) =>
          [entry.courseName, entry.teacherName].filter(Boolean).join("\n"),
        ).join("\n---\n");
        return cellEntries.length > 1 ? `CONFLIT\n${content}` : content;
      }),
    ];
  });

  autoTable(doc, {
    startY: 36,
    head: [["Heures", ...days]],
    body,
    theme: "grid",
    margin: { left: 10, right: 10, bottom: 14 },
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2, halign: "center", valign: "middle" },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 27, fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const text = Array.isArray(data.cell.text) ? data.cell.text.join(" ") : String(data.cell.text);
      if (text.includes("RECREATION")) {
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.textColor = [146, 64, 14];
        data.cell.styles.fontStyle = "bold";
      } else if (text.includes("CONFLIT")) {
        data.cell.styles.fillColor = [254, 226, 226];
        data.cell.styles.textColor = [153, 27, 27];
        data.cell.styles.fontStyle = "bold";
      }
    },
    didDrawPage: ({ pageNumber }) => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100);
      doc.text(
        `Imprime le ${new Date().toLocaleString("fr-FR")} - Page ${pageNumber}`,
        10,
        pageHeight - 6,
      );
      doc.text(context.branchName, pageWidth - 10, pageHeight - 6, { align: "right" });
    },
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7.5);
    doc.setTextColor(100);
    doc.text(`Page ${page} / ${totalPages}`, pageWidth / 2, pageHeight - 6, { align: "center" });
  }

  doc.save(`horaire-${safeFilePart(context.classeName || "classe")}.pdf`);
}
