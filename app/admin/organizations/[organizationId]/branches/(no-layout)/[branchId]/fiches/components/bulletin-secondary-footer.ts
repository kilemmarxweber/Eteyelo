import type { jsPDF } from "jspdf";

import { BULLETIN_OUTER_LINE_WIDTH_MM } from "@/lib/bulletin-layout";

export type SecondaryFooterParams = {
  doc: jsPDF;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
  city?: string;
  /** Bas du tableau (Y) — le buffer ne remonte pas au-dessus */
  tableEndY?: number;
};

const DOT = ".";

/** Date pied de page : segments noirs lisibles (évite le texte masqué / illisible). */
function drawFooterDateLine(
  doc: jsPDF,
  rightX: number,
  y: number,
  cityLabel: string,
): void {
  doc.setTextColor(0, 0, 0);
  doc.setFont("Times", "Normal");
  doc.setFontSize(9);

  const suffix = "...../...../20.....";
  const leWord = " le ";
  const city = cityLabel.trim() || "........................";
  const prefix = "Fait à ";

  const parts = [suffix, leWord, city, prefix];
  let x = rightX;
  for (const part of parts) {
    doc.text(part, x, y, { align: "right" });
    x -= doc.getTextWidth(part);
  }
}

/** Centre « Nom et signature » sous « LE CHEF D'ETABLISSEMENT ». */
function drawChefSignatureBlock(
  doc: jsPDF,
  rightX: number,
  sigRowY: number,
): void {
  const chefLabel = "LE CHEF D’ETABLISSEMENT";
  doc.setTextColor(0, 0, 0);
  doc.setFont("Times", "Bold");
  doc.setFontSize(8);
  const chefWidth = doc.getTextWidth(chefLabel);
  const chefCenterX = rightX - chefWidth / 2;
  doc.text(chefLabel, rightX, sigRowY, { align: "right" });

  doc.setFont("Times", "Normal");
  doc.setFontSize(7);
  doc.text("Nom et signature", chefCenterX, sigRowY + 4, { align: "center" });
}

/** Point 1 : pointillés contenus dans le cadre, retour à la ligne si besoin. */
function measurePoint1Wrap(
  doc: jsPDF,
  prefix: string,
  startX: number,
  rightX: number,
  desiredDotCount: number,
): { line1Dots: number; extraLines: number; line2Dots: number } {
  const dotW = doc.getTextWidth(DOT);
  if (dotW <= 0) {
    return { line1Dots: 0, extraLines: 0, line2Dots: 0 };
  }

  const prefixW = doc.getTextWidth(prefix);
  const line1Slots = Math.max(0, Math.floor((rightX - startX - prefixW) / dotW));
  const line2Slots = Math.max(0, Math.floor((rightX - startX) / dotW));

  const line1Dots = line1Slots;
  const needsWrap = desiredDotCount > line1Slots && line2Slots > 0;

  if (!needsWrap) {
    return { line1Dots, extraLines: 0, line2Dots: 0 };
  }

  // 2e ligne : pleine largeur jusqu’au même bord droit que la ligne du haut
  return { line1Dots, extraLines: 1, line2Dots: line2Slots };
}

/** Redessine le contour du cadre principal (ligne du bas visible). */
export function redrawSecondaryMainFrameBorder(
  doc: jsPDF,
  frameX: number,
  frameY: number,
  frameW: number,
  frameH: number,
): void {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(BULLETIN_OUTER_LINE_WIDTH_MM);
  doc.rect(frameX, frameY, frameW, frameH);
}

/** Bloc décision (points 1–3, signatures, notes) — bas du cadre bulletin secondaire. */
export function drawSecondaryFooterBlock({
  doc,
  frameX,
  frameY,
  frameW,
  frameH,
  city,
  tableEndY,
}: SecondaryFooterParams): void {
  doc.saveGraphicsState();

  const padX = 6;
  const padBottom = 3;
  const footerDownShift = 5;
  const sigRowUpMm = 5;
  const pointsDownMm = 3;
  const startX = frameX + padX;
  const contentW = frameW - padX * 2;
  const rightX = startX + contentW;
  const frameBottom = frameY + frameH;
  const lineHeight = 5.5;

  const cityLabel = city?.trim() || "........................";

  const notesY2 = frameBottom - padBottom;
  const notesY1 = notesY2 - lineHeight;
  const sigY = notesY1 - lineHeight * 1.25 + footerDownShift;
  const sigRowY = sigY - sigRowUpMm;

  const ligne1Prefix =
    "1. L’élève pourra passer dans la classe supérieure s’il n’a subi avec succès un Examen de repêchage en ";
  const desiredDotCount = 130;

  doc.setFont("Times", "Normal");
  doc.setFontSize(9);
  const { line1Dots, extraLines, line2Dots } = measurePoint1Wrap(
    doc,
    ligne1Prefix,
    startX,
    rightX,
    desiredDotCount,
  );
  const point1ExtraOffset = extraLines * lineHeight;

  const point3Y = sigY - lineHeight * 1.5 - point1ExtraOffset + pointsDownMm;
  const point2Y = point3Y - lineHeight;
  const point1Y = point2Y - lineHeight - point1ExtraOffset;

  const tableFloorY = tableEndY != null ? tableEndY + 0.5 : point1Y - 2;

  // Buffer points + signatures (ne couvre pas le tableau au-dessus)
  const pointsBufferTop = Math.max(point1Y - 2, tableFloorY);
  const pointsBufferBottom = sigRowY + 6;
  if (pointsBufferBottom > pointsBufferTop) {
    doc.setFillColor(255, 255, 255);
    doc.rect(
      startX - 1,
      pointsBufferTop,
      contentW + 2,
      pointsBufferBottom - pointsBufferTop,
      "F",
    );
  }

  doc.setTextColor(0, 0, 0);

  doc.text("3. L’élève double sa classe (1)", startX, point3Y);
  drawFooterDateLine(doc, rightX, point3Y, cityLabel);

  const ligne2 = "2. L’élève passe dans la classe supérieure (1)";
  const ligne2Fin =
    "...........................................................................................(1)";
  doc.text(ligne2 + ligne2Fin, startX, point2Y);

  doc.text(ligne1Prefix, startX, point1Y);
  const prefixW = doc.getTextWidth(ligne1Prefix);
  if (line1Dots > 0) {
    doc.text(DOT.repeat(line1Dots), startX + prefixW, point1Y);
  }
  if (extraLines > 0 && line2Dots > 0) {
    doc.text(DOT.repeat(line2Dots), startX, point1Y + lineHeight);
  }

  doc.setFont("Times", "Normal");
  doc.setFontSize(8);
  doc.text("Signature de l’élève", startX + 2, sigRowY);
  doc.text("Sceau de l’école", startX + contentW / 2, sigRowY, {
    align: "center",
  });
  drawChefSignatureBlock(doc, rightX, sigRowY);

  // Notes sans buffer — texte seul pour laisser le cadre visible
  doc.setFont("Times", "Bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text("(1) Biffer la mention inutile", startX, notesY1);

  doc.setFontSize(7);
  const noteImportant =
    "Note importante : le bulletin est sans valeur s’il est raturé ou surchargé.";
  const noteLines = doc.splitTextToSize(noteImportant, contentW) as string[];
  noteLines.forEach((line, index) => {
    doc.text(line, startX, notesY2 + index * 4);
  });

  doc.restoreGraphicsState();
}

export type SecondaryDecisionSidebarParams = {
  doc: jsPDF;
  x: number;
  y: number;
  width?: number;
};

/** Colonne repechage : PASSE / DOUBLE / A ECHOUE, date, chef d’établissement, sceau. */
export function drawSecondaryDecisionSidebar({
  doc,
  x,
  y,
  width = 34,
}: SecondaryDecisionSidebarParams): void {
  doc.saveGraphicsState();

  const lineGap = 3.8;
  const blockHeight = 22;
  const fontSize = 7.5;

  doc.setFillColor(255, 255, 255);
  doc.rect(x, y - 0.5, width, blockHeight, "F");

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);

  const lines = ["- PASSE (1)", "- DOUBLE (1)", "- A ECHOUE (1)"];
  lines.forEach((text, i) => {
    doc.text(text, x + 1, y + i * lineGap);
  });

  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const monthNames = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ];
  const month = monthNames[today.getMonth()];
  const year = today.getFullYear();
  const formattedDate = `${day} ${month} ${year}`;

  const dateY = y + lines.length * lineGap + 1.8;
  doc.setFont("Times", "Bold");
  doc.setFontSize(fontSize);
  const leLabel = "Le ";
  const dateCenterX = x + width / 2;
  const dateFullW = doc.getTextWidth(leLabel + formattedDate);
  doc.text(leLabel, dateCenterX - dateFullW / 2, dateY);
  doc.text(
    formattedDate,
    dateCenterX - dateFullW / 2 + doc.getTextWidth(leLabel),
    dateY,
  );

  doc.setFont("Times", "Bold");
  doc.setFontSize(fontSize);
  doc.text("Le Chef d’Etablissement", x + width / 2, dateY + lineGap + 0.5, {
    align: "center",
  });
  doc.text("Sceau de l’Ecole", x + width / 2, dateY + lineGap * 2 + 0.5, {
    align: "center",
  });

  doc.restoreGraphicsState();
}
