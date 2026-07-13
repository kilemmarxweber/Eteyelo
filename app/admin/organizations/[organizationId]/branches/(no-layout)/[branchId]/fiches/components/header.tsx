// components/pdf/header.ts

import jsPDF from "jspdf";
import type { BulletinBranchContext } from "@/lib/bulletin-context";

interface HeaderProps {
  doc: jsPDF;
  imageData1: string;
  imageData2: string;
  margin: number;
  frameWidth: number;
  branchContext: BulletinBranchContext;
}

export function drawHeader({
  doc,
  imageData1,
  imageData2,
  margin,
  frameWidth,
  branchContext,
}: HeaderProps) {
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

  doc.setFont("times", "bold");
  doc.setFontSize(13);

  doc.text(
    branchContext.branchName || branchContext.organizationName || "-",
    margin + frameWidth / 2,
    headerY + 8,
    { align: "center" },
  );

  doc.setFontSize(11);
  doc.setTextColor(255, 0, 0);

  doc.text(
    branchContext.address || "-",
    margin + frameWidth / 2,
    headerY + 14,
    { align: "center" },
  );

  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  const text = [branchContext.city, branchContext.country]
    .filter(Boolean)
    .join(" / ") || "-";
  const x = margin + frameWidth / 2;
  const y = headerY + 18;

  doc.text(text, x, y, { align: "center" });

  const textWidth = doc.getTextWidth(text);

  doc.setLineWidth(0.3);
  doc.line(x - textWidth / 2, y, x + textWidth / 2, y);

  const baseY = headerY + 22;
  const centerX = margin + frameWidth / 2;

  const part1 = branchContext.organizationName || branchContext.branchName;
  const part2 = branchContext.branchCode
    ? ` / Code : ${branchContext.branchCode}`
    : "";

  doc.setFontSize(10);

  const w1 = doc.getTextWidth(part1);
  const w2 = doc.getTextWidth(part2);

  const totalW = w1 + w2;

  const startX = centerX - totalW / 2;

  doc.setTextColor(0, 0, 255);

  doc.text(part1, startX, baseY);

  doc.line(startX, baseY, startX + w1, baseY);

  doc.setTextColor(0, 0, 0);

  doc.text(part2, startX + w1, baseY);
}
