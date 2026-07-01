// components/pdf/footer.ts

import jsPDF, { GState } from "jspdf";

interface FooterProps {
  doc: jsPDF;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  qrCode: string;
  imageData3: string;
  imageData4: string;
  y0: number;
}

export function drawFooter({
  doc,
  pageWidth,
  pageHeight,
  margin,
  qrCode,
  imageData3,
  imageData4,
}: FooterProps) {
  const footerHeight = 25;
  const y = pageHeight - footerHeight - 5;

  const centerX = pageWidth / 2;

  doc.addImage(qrCode, "PNG", margin + 10, y, 25, 20);

  doc.addImage(imageData3, "PNG", margin + 55, y, 25, 20);

  doc.setFontSize(6);

  doc.text("in partnership", centerX - 3, y + 15, {
    align: "center",
  });

  doc.addImage(imageData4, "PNG", pageWidth - margin - 85, y, 25, 20);

  doc.setFont("Times", "bold");
  doc.setFontSize(11);

  const sealText = "School Seal";

  const sealX = pageWidth - margin - 20;
  const sealY = y + 10;

  doc.text(sealText, sealX, sealY, {
    align: "center",
  });

  const textWidth = doc.getTextWidth(sealText);

  doc.line(sealX - textWidth / 2, sealY + 1, sealX + textWidth / 2, sealY + 1);
}

export function drawWatermark(
  doc: jsPDF,
  pageWidth: number,
  y0: number,
  imageData3: string,
  imageData4: string,
) {
  const imgW = 80;
  const imgH = 80;
  const gap = 10; // espace entre les 2 images

  const totalWidth = imgW * 2 + gap;

  const startX = pageWidth / 2 - totalWidth / 2;
  const centerY = y0 + 25; // zone matières

  // 🔥 transparence
  const gState = new GState({ opacity: 0.08 });
  doc.setGState(gState);
  // ================= IMAGE 1 =================
  doc.addImage(imageData3, "PNG", startX, centerY, imgW, imgH);

  // ================= IMAGE 2 =================
  doc.addImage(imageData4, "PNG", startX + imgW + gap, centerY, imgW, imgH);

  // 🔙 reset opacité
  const resetGState = new GState({ opacity: 1 });
  doc.setGState(resetGState);
}
