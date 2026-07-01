import jsPDF from "jspdf";
import { Section } from "./types";
import { getAttendance, getGradeScale, getSections } from "./data";

interface BodyProps {
  doc: jsPDF;
  margin: number;
  frameWidth: number;
  imageData1: string;
  imageData2: string;
}

/* =========================================================
   MAIN
========================================================= */

export function drawBody({
  doc,
  margin,
  frameWidth,
  imageData1,
  imageData2,
}: BodyProps) {
  // ================= HEADER =================
  const headerY = margin;

  const flagW = 25;
  const flagH = 15;

  doc.addImage(imageData1, "PNG", margin + 2, headerY + 3, flagW, flagH);
  doc.addImage(
    imageData2,
    "PNG",
    margin + frameWidth - flagW - 2,
    headerY + 3,
    flagW,
    flagH,
  );

  const boxX = margin + flagW + 5;
  const boxW = frameWidth - (flagW * 2 + 10);

  doc.setDrawColor(0);
  doc.roundedRect(boxX, headerY + 2, boxW, 22, 3, 3);
  doc.setFont("consolas");
  doc.setFontSize(13);
  doc.text(
    "SPRING OF LIFE INTERNATIONAL CHRISTIAN SCHOOL",
    margin + frameWidth / 2,
    headerY + 8,
    { align: "center" },
  );

  doc.setFontSize(11);
  doc.setTextColor(255, 0, 0);
  doc.text(
    "67, Avenue Nguma BINZA - MACAMPAGNE",
    margin + frameWidth / 2,
    headerY + 14,
    {
      align: "center",
    },
  );
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  const text = "Kinshasa/Ngaliema";
  const x = margin + frameWidth / 2;
  const y = headerY + 18;

  // texte centré
  doc.text(text, x, y, { align: "center" });

  // 🔥 soulignement
  const textWidth = doc.getTextWidth(text);
  doc.setLineWidth(0.3);
  doc.line(x - textWidth / 2, y, x + textWidth / 2, y);

  const baseY = headerY + 22;
  const centerX = margin + frameWidth / 2;

  const part1 = "www.ecsv24.org";
  const part2 = " / FB : Ecoles Chrétiennes La Source de Vie";

  doc.setFontSize(10);

  // mesurer les largeurs pour centrer l’ensemble
  const w1 = doc.getTextWidth(part1);
  const w2 = doc.getTextWidth(part2);
  const totalW = w1 + w2;

  const startX = centerX - totalW / 2;

  // 🔵 TEXTE BLEU
  doc.setTextColor(0, 0, 255);
  doc.text(part1, startX, baseY);

  doc.setDrawColor(0, 0, 255);
  doc.setLineWidth(0.2);
  doc.line(startX, baseY, startX + w1, baseY);

  // 🔙 RESET COULEUR (IMPORTANT)
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  // ⚫ TEXTE NORMAL
  doc.text(part2, startX + w1, baseY);
  // ================= PART 2 (NORMAL NOIR) =================
  doc.setTextColor(0, 0, 0);
  doc.text(part2, startX + w1, baseY);

  //END HEADER
  // ================= INFO =================
  const infoY = headerY + 25.6;

  const infoH = 29;

  doc.rect(margin, infoY, frameWidth, infoH);
  const titleY = infoY + 6;
  const separatorStartY = titleY + 10;
  const separatorEndY = infoY + infoH;
  doc.setLineWidth(0.2);
  doc.line(
    margin + frameWidth / 2,
    separatorStartY,
    margin + frameWidth / 2,
    separatorEndY,
  );
  // TITRE
  doc.setFont("consolas", "bold");
  doc.setFontSize(16);

  const title = "REPORT CARD";
  doc.text(title, margin + frameWidth / 2, titleY, {
    align: "center",
  });

  // 🔥 ligne sous le titre (basée sur font size)
  const titleWidth = doc.getTextWidth(title);
  const lineY = titleY + 1.5;

  doc.setLineWidth(0.3);
  doc.line(
    margin + frameWidth / 2 - titleWidth / 2,
    lineY,
    margin + frameWidth / 2 + titleWidth / 2,
    lineY,
  );
  const idY = lineY + 6; // espace propre sous la ligne

  doc.setFont("consolas");
  doc.setFontSize(11);
  function drawIdBoxes(
    doc: jsPDF,
    x: number,
    y: number,
    size: number,
    widths: number[],
    values: string[],
    spacing: number = 3,
    alignments: ("left" | "center" | "right")[] = [], // 👈 NEW
  ) {
    let currentX = x;

    for (let i = 0; i < widths.length; i++) {
      const width = widths[i] * size;

      doc.rect(currentX, y, width, size);

      if (values[i]) {
        doc.setFont("consolas");
        doc.setFontSize(8);

        const align = alignments[i] || "center";

        let textX = currentX + width / 2;

        if (align === "left") textX = currentX + 1.5; // 👈 petit padding
        if (align === "right") textX = currentX + width - 1.5;

        doc.text(values[i], textX, y + size / 2 + 1, {
          align,
        });
      }

      currentX += width + spacing;
    }
  }
  const squareY = idY - 3;
  const widths = [5, 6, 5, 4, 5, 5, 5, 5, 5];
  const alignments: ("left" | "center" | "right")[] = [
    "left",
    "center",
    "center",
    "center",
    "center",
    "center",
    "center",
    "center",
    "center",
  ];
  const values = ["N°", "2026", "05", "1", "2", "3", "4", "-", "-"];

  // ta grille de carrés bien alignée à droite du label
  drawIdBoxes(doc, 12, squareY, 3, widths, values, 1, alignments);

  const infoOffset = 6; // ajuste 3–6 selon ton rendu
  doc.setFont("consolas", "bold");
  doc.setFontSize(9);

  doc.text(
    "STUDENT NAME : MUNZEMBA ESDRAS",
    margin + 6,
    infoY + 12 + infoOffset,
  );
  doc.text(
    "Birthplace/Date: Kinshasa - Apr 11, 2002",
    margin + 6,
    infoY + 17 + infoOffset,
  );

  doc.text("GRADE: PYP 4 A", margin + 6, infoY + 22 + infoOffset);

  doc.text(
    "- TEACHER NAME : AGASA CHRIS",
    margin + frameWidth / 2 + 8,
    infoY + 12 + infoOffset,
  );

  doc.text(
    "- SCHOOL YEAR : 2025 - 2026",
    margin + frameWidth / 2 + 8,
    infoY + 17 + infoOffset,
  );
  // ================= TABLE SOCIALS STUDIES =================
  doc.setLineWidth(0.2);

  // ================= MIDDLE TABLES =================
  const middleY = infoY + infoH + 2;

  const rowH = 5;
  const halfWidth = frameWidth / 2 - 2;

  // ===== LEFT TABLE (ATTENDANCE)
  const leftX = margin;

  doc.setFont("consolas", "bold");
  const totalWidth = halfWidth;

  const { attendanceRows } = getAttendance();

  // Option pour réduire si nécessaire (true pour activer la réduction)
  const reduceIfNeeded = true;

  const attendanceLabelWidth = Math.max(
    doc.getTextWidth("ATTENDANCE"),
    ...attendanceRows.map((row) => doc.getTextWidth(row.label)),
  );
  const smallLabelWidth = Math.max(
    doc.getTextWidth("2nd TERM"),
    doc.getTextWidth("TOTAL"),
    ...attendanceRows.map((row) => doc.getTextWidth(row.value1)),
    ...attendanceRows.map((row) => doc.getTextWidth(row.value2)),
  );

  // Ratio d'avant : 0.6 pour ATTENDANCE, 0.2 pour les autres
  const baseWAttendance = totalWidth * 0.6;
  const baseWSmall = totalWidth * 0.2;

  let wAttendance = baseWAttendance;
  let wSmall = baseWSmall;

  if (reduceIfNeeded) {
    // Réduire si le contenu est plus petit
    const contentWAttendance = Math.max(
      attendanceLabelWidth + 16,
      totalWidth * 0.4,
    );
    const contentWSmall = Math.max(smallLabelWidth + 14, totalWidth * 0.14);

    wAttendance = Math.min(baseWAttendance, contentWAttendance);
    wSmall = Math.min(baseWSmall, contentWSmall);
  }

  // Column headers
  doc.setFillColor(192, 192, 192);
  doc.rect(leftX, middleY, wAttendance, rowH, "FD");

  doc.rect(leftX + wAttendance, middleY, wSmall, rowH, "FD");

  doc.rect(leftX + wAttendance + wSmall, middleY, wSmall, rowH, "FD");

  doc.setFillColor(192, 192, 192);
  doc.text("ATTENDANCE", leftX + 2, middleY + 4);

  doc.text("2nd TERM", leftX + wAttendance + 2, middleY + 4);

  doc.text("TOTAL", leftX + wAttendance + wSmall + 2, middleY + 4);

  doc.setFont("helvetica", "normal");

  attendanceRows.forEach((row, i) => {
    const y = middleY + rowH * (i + 1);

    doc.rect(leftX, y, wAttendance, rowH);
    doc.rect(leftX + wAttendance, y, wSmall, rowH);
    doc.rect(leftX + wAttendance + wSmall, y, wSmall, rowH);

    doc.text(row.label, leftX + 2, y + 4);
    doc.text(row.value1, leftX + wAttendance + 2, y + 4);
    doc.text(row.value2, leftX + wAttendance + wSmall + 2, y + 4);
  });

  // ===== RIGHT TABLE (GRADE SCALE)
  const rightX = margin + frameWidth / 2 + 14; // Décalé légèrement à droite

  doc.setFont("consolas", "bold");

  // Data rows
  const { gradeRows } = getGradeScale();

  // Option pour réduire si nécessaire (true pour activer la réduction)
  const reduceGradeIfNeeded = true;

  const gradeScaleLabelWidth = Math.max(
    doc.getTextWidth("Grade Scale"),
    ...gradeRows.map((row) => doc.getTextWidth(row.scale)),
  );
  const descriptorLabelWidth = Math.max(
    doc.getTextWidth("Descriptor"),
    ...gradeRows.map((row) => doc.getTextWidth(row.descriptor)),
  );

  // Ratio de base : halfWidth / 2 pour chaque colonne
  const baseWGradeScale = halfWidth / 2;
  const baseWDescriptor = halfWidth / 2;

  let wGradeScale = baseWGradeScale;
  let wDescriptor = baseWDescriptor;

  if (reduceGradeIfNeeded) {
    // Réduire si le contenu est plus petit
    const contentWGradeScale = Math.max(
      gradeScaleLabelWidth + 16,
      halfWidth * 0.3,
    );
    const contentWDescriptor = Math.max(
      descriptorLabelWidth + 14,
      halfWidth * 0.2,
    );

    wGradeScale = Math.min(baseWGradeScale, contentWGradeScale);
    wDescriptor = Math.min(baseWDescriptor, contentWDescriptor);
  }

  const gradeHeaderRowH = 6;
  const gradeRowH = 5;

  // Header row (hauteur 6)
  doc.setFillColor(192, 192, 192);
  doc.rect(rightX, middleY, wGradeScale, gradeHeaderRowH, "FD");
  doc.rect(rightX + wGradeScale, middleY, wDescriptor, gradeHeaderRowH, "FD");

  doc.text("Grade Scale", rightX + 2, middleY + 4);
  doc.text("Descriptor", rightX + wGradeScale + 2, middleY + 4);

  doc.setFont("helvetica", "normal");

  gradeRows.forEach((row, i) => {
    const y = middleY + gradeHeaderRowH + gradeRowH * i;

    doc.rect(rightX, y, wGradeScale, gradeRowH);
    doc.rect(rightX + wGradeScale, y, wDescriptor, gradeRowH);

    doc.text(row.scale, rightX + 2, y + 3);
    doc.text(row.descriptor, rightX + wGradeScale + 2, y + 3);
  });
  const tableY = middleY + 44;
  const x0 = margin;
  let y0 = tableY;
  const hRow = 5; // 🔥 FIX IMPORTANT
  // Base structure (on ajuste pour ajouter MAX1)
  const wSubjects = frameWidth * 0.2;
  const wMax1 = frameWidth * 0.07; // 🔥 nouvelle colonne
  const wPeriod = frameWidth * 0.14; // réduit
  const wPeriod2 = frameWidth * 0.14; // réduit
  const wBlank = wMax1;

  const remaining =
    frameWidth - (wSubjects + wMax1 + wPeriod + wPeriod2 + wBlank);

  const wExam = remaining / 2;
  const wMax = remaining / 2;

  // Heights
  const hSuper = 5;
  const hTop = 8;
  const hMid = 5;
  const hTitle = 4; // 🔥 Reduced title frame height

  // ================= TITLE =================
  doc.setFillColor(192, 192, 192);
  doc.rect(x0, y0 - hSuper, frameWidth, hSuper, "F");
  doc.rect(x0, y0 - hSuper, frameWidth, hSuper);

  doc.setFont("consolas", "bold");
  doc.setFontSize(10);
  doc.text("SOCIAL STUDIES", x0 + frameWidth / 2, y0 - hSuper / 2 + 0.5, {
    align: "center",
  });

  // ================= HEADER =================
  doc.rect(x0, y0, frameWidth, hTop);

  // SUBJECTS
  doc.rect(x0, y0, wSubjects, hTop);

  // 🔥 MAX1 (avec titre EXAM)
  const xMax1 = x0 + wSubjects;
  doc.rect(xMax1, y0, wMax1, hTop);
  doc.text("", xMax1 + wMax1 / 2, y0 + 5, { align: "center" });

  // 3rd PERIOD
  const x3 = xMax1 + wMax1;
  doc.rect(x3, y0, wPeriod, hTop);
  doc.text("3rd\nPERIOD", x3 + wPeriod / 2, y0 + 2.5, {
    align: "center",
  });

  // BLANK
  const xBlank = x3 + wPeriod;
  doc.rect(xBlank, y0, wBlank, hTop);

  // 4th PERIOD
  const x4 = xBlank + wBlank;
  doc.rect(x4, y0, wPeriod2, hTop);
  doc.text("4th\nPERIOD", x4 + wPeriod2 / 2, y0 + 2.5, {
    align: "center",
  });

  // EXAM
  const xExam = x4 + wPeriod2;
  doc.rect(xExam, y0, wExam, hTop);
  doc.text("EXAM", xExam + wExam / 2, y0 + 5, {
    align: "center",
  });

  // MAX TERM
  const xMax = xExam + wExam;
  doc.rect(xMax, y0, wMax, hTop);
  doc.text("MAX TERM", xMax + wMax / 2, y0 + 5, {
    align: "center",
  });
  // ================= SECOND ROW =================
  const ySub = y0 + hTop;
  doc.setFont("helvetica", "normal");
  // SUBJECTS
  doc.rect(x0, ySub, wSubjects, hMid);
  doc.text("SUBJECTS", x0 + wSubjects / 2, ySub + 3, {
    align: "center",
  });

  // 🔥 MAX1 VALUE
  doc.rect(xMax1, ySub, wMax1, hMid);
  doc.text("MAX", xMax1 + wMax1 / 2, ySub + 3, {
    align: "center",
  });

  // 3rd PERIOD
  doc.rect(x3, ySub, wPeriod / 2, hMid);
  doc.rect(x3 + wPeriod / 2, ySub, wPeriod / 2, hMid);
  doc.text("", x3 + wPeriod / 4, ySub + 3, { align: "center" });
  doc.text("G.S", x3 + (3 * wPeriod) / 4, ySub + 3, {
    align: "center",
  });

  // BLANK
  doc.rect(xBlank, ySub, wBlank, hMid);
  doc.text("MAX", xBlank + wBlank / 2, ySub + 3, {
    align: "center",
  });
  // 4th PERIOD
  doc.rect(x4, ySub, wPeriod2 / 2, hMid);
  doc.rect(x4 + wPeriod2 / 2, ySub, wPeriod2 / 2, hMid);
  doc.text("", x4 + wPeriod2 / 4, ySub + 3, {
    align: "center",
  });
  doc.text("G.S", x4 + (3 * wPeriod2) / 4, ySub + 3, {
    align: "center",
  });

  // EXAM
  doc.rect(xExam, ySub, wExam / 3, hMid);
  doc.rect(xExam + wExam / 3, ySub, wExam / 3, hMid);
  doc.rect(xExam + (2 * wExam) / 3, ySub, wExam / 3, hMid);

  doc.text("MAX", xExam + wExam / 6, ySub + 3, {
    align: "center",
  });
  doc.text("", xExam + wExam / 2, ySub + 3, {
    align: "center",
  });
  doc.text("G.S", xExam + (5 * wExam) / 6, ySub + 3, {
    align: "center",
  });

  // MAX TERM
  doc.rect(xMax, ySub, wMax / 3, hMid);
  doc.rect(xMax + wMax / 3, ySub, wMax / 3, hMid);
  doc.rect(xMax + (2 * wMax) / 3, ySub, wMax / 3, hMid);

  doc.text("MAX", xMax + wMax / 6, ySub + 3, {
    align: "center",
  });
  doc.text("", xMax + wMax / 2, ySub + 3, {
    align: "center",
  });
  doc.text("G.S", xMax + (5 * wMax) / 6, ySub + 3, {
    align: "center",
  });
  let totalGMax1 = 0;
  let totalGBl1 = 0;
  function drawSection(
    doc: jsPDF,
    x: number,
    y: number,
    section: Section,
    showTotalRow: boolean = true,
  ) {
    let currentY = y;

    // ================= TOTALS =================
    let totalMax1 = 0;
    let totalGs1 = "";
    let totalBl1 = 0;
    let totalBl2 = 0;
    let totalBl3 = 0;
    let totalMax2 = 0;
    let totalGs2 = "";
    let totalMax3 = 0;
    let totalGs3 = "";

    // ================= FIRST PASS (CALC TOTALS) =================
    section.subjects.forEach((s) => {
      totalMax1 += Number(s.max1) || 0;
      totalGs1 = String(""); //+= Number(s.gs1) || 0;
      totalBl1 += Number(s.bl1) || 0;
      totalMax2 += Number(s.max2) || 0;
      totalGs2 += String(""); //Number(s.gs2) || 0;
      totalBl2 += Number(s.bl2) || 0;
      totalMax3 += Number(s.max3) || 0;

      totalMax3 += Number(s.max3) || 0;
      totalGs3 += String(""); //Number(s.gs3) || 0;
      totalBl3 += Number(s.bl3) || 0;
    });

    const grandMax = totalMax1 + totalMax2 + totalMax3;
    totalGMax1 += totalMax1;
    totalGBl1 += totalBl1;

    const grandGs = totalGs1 + totalGs2 + totalGs3;

    const percentage1 = totalGMax1 > 0 ? (totalGBl1 / totalGMax1) * 100 : 0;

    // ================= SUBJECT ROWS =================
    section.subjects.forEach((s) => {
      const isTotalRow = s.name.trim().toLowerCase() === "max total";
      const isPercentageRow = s.name.trim().toLowerCase() === "percentage";

      // ================= AUTO VALUES =================
      if (isTotalRow) {
        s.max1 = String(Number(totalGMax1));
        s.bl1 = String(Number(totalGBl1));
        s.gs1 = String("");

        s.max2 = String(Number(totalMax2));
        s.gs2 = String("");

        s.max3 = String(Number(totalMax3));
        s.gs3 = String("");
      }

      if (isPercentageRow) {
        const pct = percentage1.toFixed(1);

        s.max1 = String("%");
        s.max2 = String("%");
        s.max3 = String("%");

        s.bl1 = String(Number(pct));
        s.gs2 = String("");
        s.gs3 = String("");
      }

      // ================= SUBJECT CELL =================
      doc.rect(x0, currentY, wSubjects, hRow);
      doc.text(s.name, x0 + 2, currentY + 4);

      // ================= MAX1 =================
      doc.rect(xMax1, currentY, wMax1, hRow);
      doc.text(s.max1, xMax1 + wMax1 / 2, currentY + 4, { align: "center" });

      // ================= 3rd PERIOD =================
      doc.rect(x3, currentY, wPeriod / 2, hRow);
      doc.rect(x3 + wPeriod / 2, currentY, wPeriod / 2, hRow);

      doc.text(String(s.gs1), x3 + (3 * wPeriod) / 4, currentY + 4, {
        align: "center",
      });
      doc.text(
        isPercentageRow ? `${s.bl1}%` : String(s.bl1),
        x3 + wPeriod / 4,
        currentY + 4,
        {
          align: "center",
        },
      );
      // ================= MAX2 =================
      doc.rect(xBlank, currentY, wBlank, hRow);
      doc.text(String(s.max2), xBlank + wBlank / 2, currentY + 4, {
        align: "center",
      });

      // ================= 4th PERIOD =================
      doc.rect(x4, currentY, wPeriod2 / 2, hRow);
      doc.rect(x4 + wPeriod2 / 2, currentY, wPeriod2 / 2, hRow);

      doc.text(String(s.gs2), x4 + (3 * wPeriod2) / 4, currentY + 4, {
        align: "center",
      });
      doc.text(String(s.bl2), x4 + wPeriod2 / 4, currentY + 4, {
        align: "center",
      });
      // ================= EXAM =================
      doc.rect(xExam, currentY, wExam / 3, hRow);
      doc.rect(xExam + wExam / 3, currentY, wExam / 3, hRow);
      doc.rect(xExam + (2 * wExam) / 3, currentY, wExam / 3, hRow);

      doc.text(String(s.max3), xExam + wExam / 6, currentY + 4, {
        align: "center",
      });

      doc.text(String(s.gs3), xExam + (5 * wExam) / 6, currentY + 4, {
        align: "center",
      });
      doc.text(String(s.bl3), xExam + wExam / 2, currentY + 4, {
        align: "center",
      });
      // ================= MAX TERM =================
      doc.rect(xMax, currentY, wMax / 3, hRow);
      doc.rect(xMax + wMax / 3, currentY, wMax / 3, hRow);
      doc.rect(xMax + (2 * wMax) / 3, currentY, wMax / 3, hRow);

      currentY += hRow;
    });

    // ================= TOTAL ROW =================
    if (showTotalRow) {
      doc.setFont("consolas", "bold");

      const totalLabel = "TOTAL";

      const totalMax = grandMax;
      const totalGs = grandGs;

      const totalPct = percentage1.toFixed(2);

      // SUBJECT
      doc.rect(x0, currentY, wSubjects, hRow);
      doc.text(totalLabel, x0 + 2, currentY + 4);

      // MAX1
      doc.rect(xMax1, currentY, wMax1, hRow);
      doc.text(String(totalMax1), xMax1 + wMax1 / 2, currentY + 4, {
        align: "center",
      });

      // GS1
      doc.rect(x3, currentY, wPeriod / 2, hRow);
      doc.rect(x3 + wPeriod / 2, currentY, wPeriod / 2, hRow);
      doc.text(String(totalBl1), x3 + wPeriod / 4, currentY + 4, {
        align: "center",
      });
      doc.text(String(totalGs1), x3 + (3 * wPeriod) / 4, currentY + 4, {
        align: "center",
      });

      // MAX2
      doc.rect(xBlank, currentY, wBlank, hRow);
      doc.text(String(totalMax2), xBlank + wBlank / 2, currentY + 4, {
        align: "center",
      });

      // GS2
      doc.rect(x4, currentY, wPeriod2 / 2, hRow);
      doc.rect(x4 + wPeriod2 / 2, currentY, wPeriod2 / 2, hRow);
      doc.text(String(totalBl2), x4 + wPeriod2 / 4, currentY + 4, {
        align: "center",
      });
      doc.text(String(totalGs2), x4 + (3 * wPeriod2) / 4, currentY + 4, {
        align: "center",
      });

      // EXAM
      doc.rect(xExam, currentY, wExam / 3, hRow);
      doc.rect(xExam + wExam / 3, currentY, wExam / 3, hRow);
      doc.rect(xExam + (2 * wExam) / 3, currentY, wExam / 3, hRow);
      doc.text(String(totalBl3), xExam + wExam / 2, currentY + 4, {
        align: "center",
      });
      doc.text(String(totalMax3), xExam + wExam / 6, currentY + 4, {
        align: "center",
      });
      doc.text(String(totalGs3), xExam + (5 * wExam) / 6, currentY + 4, {
        align: "center",
      });

      // MAX TERM
      doc.rect(xMax, currentY, wMax / 3, hRow);
      doc.rect(xMax + wMax / 3, currentY, wMax / 3, hRow);
      doc.rect(xMax + (2 * wMax) / 3, currentY, wMax / 3, hRow);

      currentY += hRow;

      // ================= OPTIONAL SUMMARY ROW =================
      // (percentage row auto-generated if last section is empty title)
    }

    doc.setFont("helvetica", "normal");
    return currentY;
  }

  // ================= Premiere section de body True or False =================
  const showFirstSectionHeader = false;
  // ================= RENDER =================
  const bodyStartY = ySub + hMid;

  let currentY = bodyStartY;
  const sections = getSections();
  sections.forEach((section, index) => {
    if (index > 0) currentY += 0;

    const isSignatureSection =
      section.title.trim().toLowerCase() === "signatures" &&
      section.subjects.length === 0;

    if (isSignatureSection) {
      const h = hRow * 3;
      const ySig = currentY;

      doc.setFont("consolas");
      doc.setFontSize(10);

      function drawSignature(x: number, w: number) {
        doc.rect(x, ySig, w, h);

        const text = "SIGNATURE";
        const tx = x + w / 2;
        const ty = ySig + 6;

        doc.text(text, tx, ty, { align: "center" });

        const tw = doc.getTextWidth(text);
        doc.line(tx - tw / 2, ty + 1, tx + tw / 2, ty + 1);
      }

      // ================= SUBJECT (normal)
      doc.setFillColor(192, 192, 192); // silver
      doc.rect(x0, ySig, wSubjects, h, "FD"); // Fill + Draw

      // ================= 3rd PERIOD (MAX1 + bl1 + gs1)
      const thirdX = xMax1;
      const thirdW = wMax1 + wPeriod;
      drawSignature(thirdX, thirdW);

      // ================= 4th PERIOD (max2 + bl2 + gs2)
      const fourthX = xBlank;
      const fourthW = wBlank + wPeriod2;
      drawSignature(fourthX, fourthW);

      // ================= EXAM FIRST COLUMN (alone)
      doc.rect(xExam, ySig, wExam / 3, h);

      // ================= FINAL SIGNATURE
      const finalX = xExam + wExam / 3;
      const finalW = (2 * wExam) / 3 + wMax;
      drawSignature(finalX, finalW);

      currentY += h + 5;
      return;
    }

    const shouldRenderHeader = index !== 0 || showFirstSectionHeader;

    if (shouldRenderHeader) {
      doc.setFillColor(192, 192, 192);
      doc.rect(x0, currentY, frameWidth, hTitle, "FD");

      doc.setFont("consolas");
      doc.text(section.title, x0 + frameWidth / 2, currentY + 3, {
        align: "center",
      });

      currentY += hTitle;
    }

    const autoShowTotal =
      section.title.trim() !== "" && index !== sections.length - 3;

    currentY = drawSection(doc, x0, currentY, section, autoShowTotal);
  });
}
