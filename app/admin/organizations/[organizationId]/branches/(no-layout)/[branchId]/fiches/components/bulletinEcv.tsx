"use client";

import { useCallback, useEffect, useState } from "react";
import jsPDF, { GState } from "jspdf";
import QRCode from "qrcode";
import { drawFooter, drawWatermark } from "./footer";
import { drawBody } from "./body";
interface jsPDFWithPlugin extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

// Convert file to base64
const getImageBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });

export default function BulletinPDF() {
  const [imageData1, setImageData1] = useState<string | null>(null);
  const [imageData2, setImageData2] = useState<string | null>(null);
  const [imageData3, setImageData3] = useState<string | null>(null);
  const [imageData4, setImageData4] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL("https://example.com/student/123")
      .then(setQrCode)
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetch("/uploads/rdc.png")
      .then((res) => res.blob())
      .then((blob) => getImageBase64(new File([blob], "rdc.png")))
      .then(setImageData1);
  }, []);

  useEffect(() => {
    fetch("/uploads/usa.png")
      .then((res) => res.blob())
      .then((blob) => getImageBase64(new File([blob], "usa.png")))
      .then(setImageData2);
  }, []);

  useEffect(() => {
    fetch("/uploads/cropped.png")
      .then((res) => res.blob())
      .then((blob) => getImageBase64(new File([blob], "cropped.png")))
      .then(setImageData3);
  }, []);

  useEffect(() => {
    fetch("/uploads/cornerstone.png")
      .then((res) => res.blob())
      .then((blob) => getImageBase64(new File([blob], "cornerstone.png")))
      .then(setImageData4);
  }, []);

  const generatePDF = useCallback(() => {
    if (!imageData1 || !imageData2 || !imageData3 || !imageData4 || !qrCode) {
      alert("Images non chargées");
      return;
    }

    const doc = new jsPDF("p", "mm", "a4") as jsPDFWithPlugin;
    doc.setFont("Consolas", "normal");
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    const frameWidth = pageWidth - margin * 2;

    // ================= BODY =================
    drawBody({
      doc,
      margin,
      frameWidth,
      imageData1,
      imageData2,
    });
    // ================= FOOTER =================
    drawFooter({
      doc,
      pageWidth,
      pageHeight,
      margin,
      qrCode,
      imageData3,
      imageData4,
      y0: 0,
    });
    drawWatermark(doc, pageWidth, 120.6, imageData3, imageData4);
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    setPdfUrl(url);
  }, [imageData1, imageData2, imageData3, imageData4, qrCode]);

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={generatePDF}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Générer PDF
      </button>

      {pdfUrl && <iframe src={pdfUrl} className="w-full h-[600px] border" />}
    </div>
  );
}
