"use client";

import { useCallback, useEffect, useState } from "react";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FaEye, FaTimes } from "react-icons/fa";
import {
  jsPDFWithPlugin,
  periodKeyDefinitions,
  periodKeyMap,
  PeriodLabel,
  StudentPeriod,
  Subject,
  computeTotSem1,
  canShowTot1,
  computeTotSem2,
  canShowTot2,
  BlocValue,
  drawSemesterRow1,
  drawCell1,
  drawSubjectRow,
  drawMatiere,
  generauxConfig,
} from "@/lib/types";
import { getAcademicPeriodOrder } from "@/lib/academic-structure";
import type { BulletinBranchContext } from "@/lib/bulletin-context";
import {
  aggregateBulletinPeriodMaxima,
  calculateBulletinYearMaxima,
  isValidBulletinMaxScore,
  type BulletinPeriodMaxima,
} from "@/lib/bulletin-maxima";

// Convertit un fichier en base64
const getImageBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });

export default function BulletinPDF({
  data,
  branchContext,
  label,
  variant = "outline",
  size = "default",
}: {
  data: any[];
  branchContext: BulletinBranchContext;
  label?: string;
  variant?: any;
  size?: any;
}) {
  const [imageData1, setImageData1] = useState<string | null>(null);
  const [imageData2, setImageData2] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    fetch("/uploads/rdc.png")
      .then((res) => res.blob())
      .then((blob) => getImageBase64(new File([blob], "rdc.png")))
      .then((base64) => setImageData1(base64))
      .catch(console.error);
  }, []);
  useEffect(() => {
    fetch("/uploads/armoirie.png")
      .then((res) => res.blob())
      .then((blob) => getImageBase64(new File([blob], "armoirie.png")))
      .then((base64) => setImageData2(base64))
      .catch(console.error);
  }, []);

  const generatePDF = useCallback(() => {
    if (!imageData1 || !imageData2) {
      alert("Image non chargée.");
      return;
    }

    const doc = new jsPDF("p", "mm", "a4") as jsPDFWithPlugin;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    const frameWidth = pageWidth - 2 * margin;

    const shiftX = 0;
    const shiftY = -25;
    const tableX = margin;
    const tableY = margin + 36 + 50;
    const rowHeightTotal = 20;
    const hTop = 7;
    const hMid = 7;
    const hBottom = 7;

    const colRatios = [0.2, 0.22, 0.22, 0.07, 0.09, 0.02, 0.08];
    const colWidths = colRatios.map((r) => r * frameWidth);
    const colPos = [tableX];
    colWidths.reduce((acc, w) => {
      colPos.push(acc + w);
      return acc + w;
    }, tableX);

    const semSubRatios = [0.5, 0.25, 0.25]; // TR | TOT | EXAM
    const semPeriodRatios = [0.5, 0.5];

    const sem1SubWidths = semSubRatios.map((r) => r * colWidths[1]);
    const sem2SubWidths = semSubRatios.map((r) => r * colWidths[2]);
    const sem1PeriodWidths = semPeriodRatios.map((r) => r * sem1SubWidths[0]);
    const sem2PeriodWidths = semPeriodRatios.map((r) => r * sem2SubWidths[0]);

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);

    data.forEach((student, studentIndex) => {
      if (studentIndex > 0) doc.addPage();

      // Header
      function drawTextAligned(
        line: string,
        xCenter: number,
        y: number,
        align: "left" | "center" | "right" = "center",
        offsetX: number = 0,
      ) {
        let x: number;
        if (align === "center") {
          x = xCenter + offsetX;
        } else if (align === "left") {
          x = xCenter - 50 + offsetX;
        } else {
          // right
          x = xCenter + 50 + offsetX;
        }
        doc.text(line, x, y, { align: align });
      }

      const headerHeight = 275;
      doc.rect(margin, margin, frameWidth, headerHeight);
      doc.addImage(imageData1, "PNG", margin + 3, margin + 3, 28, 17);
      doc.addImage(
        imageData2,
        "PNG",
        margin + frameWidth - 21,
        margin + 3,
        17,
        17,
      );
      doc.setFont("consolas", "bold");
      doc.setFontSize(10);
      [
        "REPUBLIQUE DEMOCRATIQUE DU CONGO",
        "MINISTERE DE L'ENSEIGNEMENT PRIMAIRE, SECONDAIRE ET",
        "INITIATION A LA NOUVELLE CITOYENNETE",
      ].forEach((line, i) => {
        drawTextAligned(
          line,
          margin + frameWidth / 2,
          margin + 8 + i * 6,
          "center",
          2,
        );
      });

      function drawTwoColumnBox(
        x: number,
        y: number,
        w: number,
        h: number,
        rowHeight: number = 7,
        showMiddleLine: boolean = true, // 🔥 ligne centrale activée par défaut
      ) {
        // 1) Contour global
        doc.setDrawColor(0, 0, 0);
        doc.rect(x, y, w, h);

        // 2) Ligne centrale optionnelle
        if (showMiddleLine) {
          const midX = x + w / 2;
          doc.line(midX, y, midX, y + h); // 🔥 correction ici
        }
      }
      function drawHorizontalSquares(
        x: number,
        y: number,
        size: number = 5, // taille du carré (largeur = hauteur)
        count: number = 8, // nombre de petits carrés
        spacing: number = 1, // espace entre chaque carré
      ) {
        doc.setDrawColor(0, 0, 0); // bord noir

        for (let i = 0; i < count; i++) {
          const squareX = x + i * (size + spacing);
          doc.rect(squareX, y, size, size); // carré vide
        }
      }
      function drawLabel(
        text: string,
        x: number,
        y: number,
        options?: {
          size?: number; // Font size
          color?: "black" | "white" | "red" | "blue" | "green" | "gray";
          align?: "left" | "center" | "right";
          bold?: boolean;
          italic?: boolean;
          underline?: boolean;
          maxWidth?: number;
        },
      ) {
        const palette: Record<string, [number, number, number]> = {
          black: [0, 0, 0],
          white: [255, 255, 255],
          red: [255, 0, 0],
          blue: [0, 0, 255],
          green: [0, 128, 0],
          gray: [128, 128, 128],
        };

        const {
          size = 11,
          color = "black",
          align = "left",
          bold = false,
          italic = false,
          underline = false,
          maxWidth,
        } = options || {};

        // 🎨 FONT STYLE
        let fontStyle = "";
        if (bold) fontStyle += "bold";
        if (italic) fontStyle += fontStyle ? "italic" : "italic";

        doc.setFont("helvetica", fontStyle || "normal");
        doc.setFontSize(size);

        if (palette[color]) doc.setTextColor(...palette[color]);

        let renderedText = text;
        if (maxWidth && doc.getTextWidth(renderedText) > maxWidth) {
          while (
            renderedText.length > 1 &&
            doc.getTextWidth(`${renderedText}…`) > maxWidth
          ) {
            renderedText = renderedText.slice(0, -1);
          }
          renderedText = `${renderedText.trimEnd()}…`;
        }

        // ✏️ Dessin du texte
        doc.text(renderedText, x, y, { align });

        // Soulignement si demandé
        if (underline) {
          const textWidth = doc.getTextWidth(renderedText);
          let underlineX = x;
          if (align === "center") underlineX = x - textWidth / 2;
          if (align === "right") underlineX = x - textWidth;

          doc.line(underlineX, y + 1, underlineX + textWidth, y + 1);
        }
      }

      const startX = margin;
      const startY = 41;
      const width = 190;
      const height = 25;
      const rowH = 7;
      drawTwoColumnBox(startX, 32, width, 9, rowH, false); // Numero ID cadre sans ligne centrale
      // Texte N° ID.
      drawLabel("N° ID.", 22, 38, {
        size: 11,
        bold: true,
        align: "right",
      });
      //cadre global  N ID
      drawHorizontalSquares(25, 34, 5, 27, 1);
      //cadre de infos Ecole et student
      drawTwoColumnBox(startX, startY, width, height, rowH); // 🔥 désactivation de la ligne centrale pour cette boîte spécifique
      //Information Ecole
      const branchLocation = [branchContext.city, branchContext.country]
        .filter(Boolean)
        .join(" / ");
      const schoolName = branchContext.organizationName
        ? `${branchContext.branchName} — ${branchContext.organizationName}`
        : branchContext.branchName;

      drawLabel(`VILLE / PAYS : ${branchLocation || "-"}`, 12, 48, {
        size: 8,
        bold: true,
        align: "left",
        maxWidth: 91,
      });
      drawLabel(`ADRESSE : ${branchContext.address || "-"}`, 12, 52, {
        size: 8,
        bold: true,
        align: "left",
        maxWidth: 91,
      });
      drawLabel(`ECOLE : ${schoolName || "-"}`, 12, 57, {
        size: 8,
        bold: true,
        align: "left",
        maxWidth: 91,
      });
      drawLabel(`CODE : ${branchContext.branchCode || "-"}`, 12, 62, {
        size: 8,
        bold: true,
        align: "left",
        maxWidth: 91,
      });
      //Information Students
      drawLabel(
        `Eleve        :        ${student.nom?.toUpperCase() ?? ""} ${
          student.studentSurname?.toUpperCase() ?? ""
        }       SEXE : ${student.studentSexe?.toUpperCase() ?? ""}`,
        110,
        48,
        {
          size: 8,
          bold: true,
          align: "left",
        },
      );
      const studentDate = student.studentnaissance
        ? new Date(student.studentnaissance)
        : null;

      const formattedDate = studentDate
        ? `${String(studentDate.getDate()).padStart(2, "0")}-${String(
            studentDate.getMonth() + 1,
          ).padStart(2, "0")}-${studentDate.getFullYear()}`
        : "";
      drawLabel(
        `Né à        :       MONT-NGAFULA             ${formattedDate ?? ""} `,
        110,
        52,
        {
          size: 9,
          bold: true,
          align: "left",
        },
      );
      drawLabel(
        `CLASSE :       ${student.studentclasse ?? "Non spécifiée"} `,
        110,
        57,
        {
          size: 9,
          bold: true,
          align: "left",
        },
      );
      drawLabel("N° PERM:  ", 110, 62, {
        size: 9,
        bold: true,
        align: "left",
      });
      //les petits cadre de code N perm
      drawHorizontalSquares(132, 59, 4, 13, 1);
      function generateFooterBlock(
        pageWidth: number,
        pageHeight: number,
        margin: number = 20,
      ): void {
        doc.saveGraphicsState();

        // Largeur totale
        const blockWidth = 220;

        // Position X (centré horizontalement)
        const startX = (pageWidth - blockWidth) / 2;

        // Position Y en bas avec marge
        const startY = pageHeight - margin - 70; // ajuste 70 selon la hauteur du bloc

        const lineHeight = 6;

        doc.setFont("Times", "Normal");
        doc.setFontSize(9);

        // 1ère phrase avec ligne de pointillés (ici underscore _ pour simulation)
        const ligne1 =
          "1. L’élève pourra passer dans la classe supérieure s’il n’a subi avec succès un Examen de repéchage en ";
        const ligne1Fin =
          "......................................................................";

        doc.text(ligne1 + ligne1Fin, startX, startY);

        // 2ème phrase + ligne de points + (1) aligné à droite
        const ligne2 = "2. L’élève passe dans la classe supérieure (1)";
        const ligne2Fin =
          "...........................................................................................(1)";

        doc.text(ligne2 + ligne2Fin, startX, startY + lineHeight);

        // Lignes 3 & 4 avec signatures et alignements particuliers

        doc.text(
          "3. L’élève double sa classe (1)",
          startX,
          startY + lineHeight * 2,
        );

        // Ligne 4 texte gauche
        doc.text(
          "4. L’élève a échoué et est orienté (1)",
          startX,
          startY + lineHeight * 3,
        );

        // Signature de l'élève (gauche bas)
        doc.text(
          "Signature de l’élève",
          startX + 5,
          startY + lineHeight * 4 + 4,
        );

        // Sceau de l'école (centré bas)
        doc.text(
          "Sceau de l’école",
          startX + blockWidth / 3,
          startY + lineHeight * 4 + 4,
          { align: "center" },
        );

        // LE CHEF D’ETABLISSEMENT et date (droite bas)
        const rightBlockX = startX + blockWidth - 8;
        doc.text(
          "Fait à ......................................... le ...../...../20.....",
          rightBlockX - 95,
          startY + lineHeight * 3,
        );
        doc.text(
          "LE CHEF D’ETABLISSEMENT",
          rightBlockX - 80,
          startY + lineHeight * 4 + 4,
        );

        // Nom et signature (droite bas, sous chef d'établissement)
        doc.text(
          "Nom et signature",
          rightBlockX - 70,
          startY + lineHeight * 5 + 4,
        );

        // Note importante en gras, tout en bas
        doc.setFont("Times", "Bold");
        const note = "(1) Biffer la mention inutile";
        const note2 =
          "Note importante : le bulletin est sans valeur s’il est raturé ou surchargé.";
        doc.text(note, startX, startY + lineHeight * 6 + 1);
        doc.text(note2, startX, startY + lineHeight * 7 + 1);

        doc.restoreGraphicsState();
      }
      generateFooterBlock(244, 330);
      // Cadre global du tableau
      doc.rect(tableX + shiftX, tableY + shiftY, frameWidth, rowHeightTotal);

      // BRANCHES
      doc.rect(
        colPos[0] + shiftX,
        tableY + shiftY,
        colWidths[0],
        rowHeightTotal,
      );
      doc.setFontSize(8);
      doc.text(
        "BRANCHES",
        colPos[0] + shiftX + colWidths[0] / 2,
        tableY + shiftY + rowHeightTotal / 2,
        { align: "center", baseline: "middle" },
      );

      // PREMIER SEMESTRE
      const xPS = colPos[1];
      doc.rect(xPS + shiftX, tableY + shiftY, colWidths[1], hTop);
      doc.text(
        "PREMIER SEMESTRE",
        xPS + shiftX + colWidths[1] / 2,
        tableY + shiftY + hTop / 2,
        { align: "center", baseline: "middle" },
      );

      let subX = xPS + shiftX;
      doc.rect(subX, tableY + hTop + shiftY, sem1SubWidths[0], hMid + hBottom);
      doc.text(
        "TR JOURN",
        subX + sem1SubWidths[0] / 2,
        tableY + hTop + shiftY + hMid / 2,
        { align: "center", baseline: "middle" },
      );
      doc.rect(
        subX + sem1SubWidths[0],
        tableY + hTop + shiftY,
        sem1SubWidths[1],
        hMid + hBottom,
      );
      doc.text(
        "EXAM",
        subX + sem1SubWidths[0] + sem1SubWidths[1] / 2,
        tableY + hTop + shiftY + (hMid + hBottom) / 2,
        { align: "center", baseline: "middle" },
      );
      doc.rect(
        subX + sem1SubWidths[0] + sem1SubWidths[1],
        tableY + hTop + shiftY,
        sem1SubWidths[2],
        hMid + hBottom,
      );
      doc.text(
        "TOT",
        subX + sem1SubWidths[0] + sem1SubWidths[1] + sem1SubWidths[2] / 2,
        tableY + hTop + shiftY + (hMid + hBottom) / 2,
        { align: "center", baseline: "middle" },
      );
      doc.rect(
        subX,
        tableY + hTop + hMid + shiftY,
        sem1PeriodWidths[0],
        hBottom,
      );
      doc.text(
        "1eP",
        subX + sem1PeriodWidths[0] / 2,
        tableY + hTop + hMid + shiftY + hBottom / 2,
        { align: "center", baseline: "middle" },
      );
      doc.rect(
        subX + sem1PeriodWidths[0],
        tableY + hTop + hMid + shiftY,
        sem1PeriodWidths[1],
        hBottom,
      );
      doc.text(
        "2eP",
        subX + sem1PeriodWidths[0] + sem1PeriodWidths[1] / 2,
        tableY + hTop + hMid + shiftY + hBottom / 2,
        { align: "center", baseline: "middle" },
      );

      // DEUXIEME SEMESTRE
      const xSS = colPos[2];
      doc.rect(xSS + shiftX, tableY + shiftY, colWidths[2], hTop);
      doc.text(
        "DEUXIEME SEMESTRE",
        xSS + shiftX + colWidths[2] / 2,
        tableY + shiftY + hTop / 2,
        { align: "center", baseline: "middle" },
      );

      subX = xSS + shiftX;
      doc.rect(subX, tableY + hTop + shiftY, sem2SubWidths[0], hMid + hBottom);
      doc.text(
        "TR JOURN",
        subX + sem2SubWidths[0] / 2,
        tableY + hTop + shiftY + hMid / 2,
        { align: "center", baseline: "middle" },
      );
      doc.rect(
        subX + sem2SubWidths[0],
        tableY + hTop + shiftY,
        sem2SubWidths[1],
        hMid + hBottom,
      );
      doc.text(
        "EXAM",
        subX + sem2SubWidths[0] + sem2SubWidths[1] / 2,
        tableY + hTop + shiftY + (hMid + hBottom) / 2,
        { align: "center", baseline: "middle" },
      );
      doc.rect(
        subX + sem2SubWidths[0] + sem2SubWidths[1],
        tableY + hTop + shiftY,
        sem2SubWidths[2],
        hMid + hBottom,
      );
      doc.text(
        "TOT",
        subX + sem2SubWidths[0] + sem2SubWidths[1] + sem2SubWidths[2] / 2,
        tableY + hTop + shiftY + (hMid + hBottom) / 2,
        { align: "center", baseline: "middle" },
      );
      doc.rect(
        subX,
        tableY + hTop + hMid + shiftY,
        sem2PeriodWidths[0],
        hBottom,
      );
      doc.text(
        "3eP",
        subX + sem2PeriodWidths[0] / 2,
        tableY + hTop + hMid + shiftY + hBottom / 2,
        { align: "center", baseline: "middle" },
      );
      doc.rect(
        subX + sem2PeriodWidths[0],
        tableY + hTop + hMid + shiftY,
        sem2PeriodWidths[1],
        hBottom,
      );
      doc.text(
        "4eP",
        subX + sem2PeriodWidths[0] + sem2PeriodWidths[1] / 2,
        tableY + hTop + hMid + shiftY + hBottom / 2,
        { align: "center", baseline: "middle" },
      );

      // Colonnes finales
      doc.rect(
        colPos[3] + shiftX,
        tableY + shiftY,
        colWidths[3],
        rowHeightTotal,
      );
      doc.text(
        "TG",
        colPos[3] + shiftX + colWidths[3] / 2,
        tableY + shiftY + rowHeightTotal / 2,
        { align: "center", baseline: "middle" },
      );
      doc.rect(
        colPos[4] + shiftX,
        tableY + shiftY,
        colWidths[4],
        rowHeightTotal,
      );
      doc.text(
        "SIGN PROF",
        colPos[4] + shiftX + colWidths[4] / 2,
        tableY + shiftY + rowHeightTotal / 2,
        { align: "center", baseline: "middle" },
      );
      doc.setDrawColor(0, 0, 0);
      doc.rect(colPos[5] + shiftX, tableY + shiftY, 4, rowHeightTotal, "F");
      doc.text(
        "",
        colPos[5] + shiftX + colWidths[4] / 2,
        tableY + shiftY + rowHeightTotal / 2,
        { align: "center", baseline: "middle" },
      );
      doc.rect(colPos[6] + shiftX, tableY + shiftY, 34.1, rowHeightTotal);
      doc.setFontSize(8);
      doc.text(
        ["EXAMEN DE", "REPECHAGE"],
        colPos[6] + shiftX + colWidths[0] / 2,
        tableY + shiftY + rowHeightTotal / 2 - 5,
        { align: "center", baseline: "middle" },
      );
      function generateDecisionBlock(x: number, y: number) {
        // Sauvegarde de l'état avant modifications
        doc.saveGraphicsState();

        // Font par défaut pour ce bloc uniquement
        doc.setFont("Consolas", "bold");
        doc.setFontSize(7);

        // --- TEXTES DE DÉCISION ---
        const lines = ["- PASSE (1)", "- DOUBLE (1)", "- A ECHOUÉ (1)"];

        lines.forEach((text, i) => {
          doc.text(text, x, y + i * 5);
        });

        // --- DATE AUTOMATIQUE ---
        const today = new Date();
        const day = String(today.getDate()).padStart(2, "0");
        const moisNoms = [
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
        const month = moisNoms[today.getMonth()];
        const year = today.getFullYear();
        const formattedDate = `${day} ${month} ${year}`;
        doc.setFont("Times", "Bold");
        doc.text(`Le ${formattedDate}`, 169, 196 + 3 * 6 + 10);
        doc.setFont("Times", "Bold");
        doc.text("Le Chef d’Etablissement", 182, 185 + 3 * 6 + 25, {
          align: "center",
        });

        doc.setFont("Times", "Bold");
        doc.text("Sceau de l’Ecole", 182, 181 + 3 * 6 + 32, {
          align: "center",
        });

        // 🔥 Restaure l’état graphique avant les changements
        doc.restoreGraphicsState();
      }
      generateDecisionBlock(169, 210);

      // Taille des petits cadres en bas
      const frameHeight = 6;
      const totalWidth = 34.1;
      const leftWidth = 13;
      const rightWidth = totalWidth - leftWidth;

      // Position Y = en bas du grand cadre
      const bottomY = tableY + shiftY + rowHeightTotal - frameHeight;

      // Cadre de gauche (%)
      doc.rect(colPos[6] + shiftX, bottomY, leftWidth, frameHeight);
      doc.text(
        "%",
        colPos[6] + shiftX + leftWidth / 2,
        bottomY + frameHeight / 2,
        { align: "center", baseline: "middle" },
      );

      // Cadre de droite (Signature)
      doc.rect(
        colPos[6] + shiftX + leftWidth,
        bottomY,
        rightWidth,
        frameHeight,
      );
      doc.text(
        "Signature",
        colPos[6] + shiftX + leftWidth + rightWidth / 2,
        bottomY + frameHeight / 2,
        { align: "center", baseline: "middle" },
      );

      // -------------------- BLOCS & MAXIMA --------------------

      const validPeriods = student.periods.filter(
        (p: any): p is StudentPeriod => p.periodName in periodKeyMap,
      );
      const selectedPeriod = [...validPeriods]
        .sort(
          (a, b) =>
            getAcademicPeriodOrder(a.periodName) -
            getAcademicPeriodOrder(b.periodName),
        )
        .at(-1)?.periodName as PeriodLabel;

      if (!selectedPeriod) {
        throw new Error("Période invalide ou inconnue");
      }
      const semesterPeriods: Partial<Record<PeriodLabel, string[]>> = {
        "1ere Periode": ["p1"],
        "2e Periode": ["p1", "p2"],
        "Examen 1er semestre": ["p1", "p2", "exam1"],
        "3e Periode": ["p1", "p2", "exam1", "p3"],
        "4e Periode": ["p1", "p2", "exam1", "p3", "p4"],
        "Examen 2e semestre": ["p1", "p2", "exam1", "p3", "p4", "exam2"],
        "Examen 1er trimestre": ["p1", "p2", "exam1"],
        "Examen 2e trimestre": ["p1", "p2", "exam1", "p3", "p4", "exam2"],
        "Examen 3e trimestre": [
          "p1",
          "p2",
          "exam1",
          "p3",
          "p4",
          "exam2",
          "p5",
          "p6",
          "exam3",
        ],
        "1st Period": ["p1"],
        "2nd Period": ["p1", "p2"],
        "Exam 1st semester": ["p1", "p2", "exam1"],
        "3tr Period": ["p1", "p2", "exam1", "p3"],
        "4th Period": ["p1", "p2", "exam1", "p3", "p4"],
        "Exam 2nd semester": ["p1", "p2", "exam1", "p3", "p4", "exam2"],
      };

      const activePeriodKeys = semesterPeriods[selectedPeriod];

      if (!activePeriodKeys) {
        throw new Error(`Période inconnue: ${selectedPeriod}`);
      }
      // --- Generate the subject map ---
      type SubjectWithMaxima = Subject & { maxima: BulletinPeriodMaxima };
      type DynamicBloc = {
        blocName: string;
        subjects: Subject[];
        maxima: BulletinPeriodMaxima;
        isGeneraux?: boolean;
      };

      const subjectMap: Record<string, SubjectWithMaxima> = {};

      function safeStr(value: unknown): string {
        if (value === null || value === undefined) return "";
        if (typeof value === "number") return value === 0 ? "" : String(value);
        if (typeof value === "string") return value.trim();
        return "";
      }
      const allSubjects = new Set<string>(
        student.periods.flatMap((p: StudentPeriod) =>
          Object.keys(p.notes || {}),
        ),
      );

      for (const subjectName of allSubjects) {
        subjectMap[subjectName] = {
          name: subjectName,
          sem1: { p1: 0, p2: 0, exam1: 0 },
          sem2: { p3: 0, p4: 0, exam2: 0 },
          sem3: { p5: 0, p6: 0, exam3: 0 },
          baseMaxScore: 0,
          maxima: {},
        };
      }
      student.periods.forEach((period: StudentPeriod) => {
        const periodKey = periodKeyMap[period.periodName as PeriodLabel];
        if (!periodKey) return;

        const semester = periodKeyDefinitions[periodKey];
        if (!semester) return;

        Object.entries(period.notes || {}).forEach(([subjectName, note]) => {
          const subject = subjectMap[subjectName];
          if (!subject) return;

          subject[semester] = subject[semester] ?? {};
          subject[semester][periodKey] = Number(note.score) || 0;

          if (isValidBulletinMaxScore(note.maxScore)) {
            subject.maxima[periodKey] = note.maxScore;
          }

          if (
            !subject.baseMaxScore &&
            periodKey !== "exam1" &&
            periodKey !== "exam2" &&
            periodKey !== "exam3" &&
            isValidBulletinMaxScore(note.maxScore)
          ) {
            subject.baseMaxScore = note.maxScore;
          }
        });
      });

      Object.values(subjectMap).forEach((subject) => {
        if (subject.baseMaxScore) return;

        const examMaximum =
          subject.maxima.exam1 ??
          subject.maxima.exam2 ??
          subject.maxima.exam3;
        if (isValidBulletinMaxScore(examMaximum)) {
          subject.baseMaxScore = examMaximum / 2;
        }
      });

      const autresByPeriod: Record<string, any> = {};

      student.periods.forEach((p: StudentPeriod) => {
        const key = periodKeyMap[p.periodName as PeriodLabel];
        if (!key) return;

        if (p.autres) {
          autresByPeriod[key] = p.autres;
        }
      });
      const flattenedAutres = Object.values(autresByPeriod).flatMap((autres) =>
        Object.entries(autres),
      );

      const createEmptySubject = (): Subject => ({
        name: "",
        sem1: {},
        sem2: {},
        baseMaxScore: 0,
      });

      const typeDSubjects: Subject[] =
        flattenedAutres.length > 0
          ? flattenedAutres
              .slice(0, 6) // ✅ limite à 4 itérations
              .map(([key, value]) => {
                const typedValue = value as BlocValue;

                return {
                  name: key,
                  sem1: Object.fromEntries(
                    Object.entries(typedValue.sem1).map(([k, v]) => [
                      k,
                      Number(v) || 0,
                    ]),
                  ),
                  sem2: Object.fromEntries(
                    Object.entries(typedValue.sem2).map(([k, v]) => [
                      k,
                      Number(v) || 0,
                    ]),
                  ),
                  baseMaxScore: 0,
                };
              })
          : [createEmptySubject()];

      const periodSignatureKeys = [
        "p1",
        "p2",
        "exam1",
        "p3",
        "p4",
        "exam2",
        "p5",
        "p6",
        "exam3",
      ] as const;
      const courseBlocsMap = new Map<string, DynamicBloc>();

      Object.values(subjectMap).forEach((subject) => {
        const signature = periodSignatureKeys
          .map((key) => subject.maxima[key] ?? 0)
          .join(":");
        const existingBloc = courseBlocsMap.get(signature);

        if (existingBloc) {
          existingBloc.subjects.push(subject);
          return;
        }

        courseBlocsMap.set(signature, {
          blocName: "",
          subjects: [subject],
          maxima: subject.maxima,
        });
      });

      // tri des généraux une seule fois
      const order = [
        "TOTAUX",
        "POURCENTAGES",
        "PLACE/NOMBRE D'ELEVES",
        "APPLICATIONS",
        "CONDUITE",
        "SIGNATURE PARENTS",
      ];

      typeDSubjects.sort(
        (a, b) => order.indexOf(a.name) - order.indexOf(b.name),
      );

      const subjectMaxima = Object.values(subjectMap).map(
        (subject) => subject.maxima,
      );
      const generalMaxima = aggregateBulletinPeriodMaxima(subjectMaxima);
      const blocs: DynamicBloc[] = [
        ...courseBlocsMap.values(),
        {
          blocName: "GENERAUX",
          subjects: typeDSubjects,
          maxima: generalMaxima,
          isGeneraux: true,
        },
      ];
      // Hauteur des lignes
      const maximaHeight = 5;
      let yPosBlocs = tableY + shiftY + rowHeightTotal;

      // Fonction utilitaire pour dessiner une cellule
      function drawCell(
        x: number,
        y: number,
        w: number,
        h: number,
        text: string,
        isMaxima = false,
        align: "left" | "center" | "right" = "center",
        color:
          | "black"
          | "white"
          | "red"
          | "blue"
          | "green"
          | { text?: string; fill?: string } = "black",

        // ⭐ GESTION 4 BORDURES
        borders?: {
          top?: boolean;
          bottom?: boolean;
          left?: boolean;
          right?: boolean;
        },
      ) {
        // 🎨 Palette simple
        const palette: Record<string, [number, number, number]> = {
          black: [0, 0, 0],
          white: [255, 255, 255],
          red: [255, 0, 0],
          blue: [0, 0, 255],
          green: [0, 128, 0],
          yellow: [255, 255, 0],
          gray: [128, 128, 128],
        };

        // Valeurs par défaut
        let textColor: [number, number, number] = palette.black;
        let fillColor: [number, number, number] = palette.white;

        if (typeof color === "string") {
          if (palette[color]) textColor = palette[color];
        } else {
          if (color.text && palette[color.text])
            textColor = palette[color.text];
          if (color.fill && palette[color.fill])
            fillColor = palette[color.fill];
        }

        // Maxima = noir/blanc
        if (isMaxima) {
          doc.setFillColor(0, 0, 0);
          doc.setTextColor(255, 255, 255);
        } else {
          doc.setFillColor(...fillColor);
          doc.setTextColor(...textColor);
        }

        // 🧱 Dessiner le fond
        doc.rect(x, y, w, h, "F");

        // ---------------------------------
        // ⭐ Gestion des 4 bordures
        // ---------------------------------

        const drawTop = borders?.top ?? true;
        const drawBottom = borders?.bottom ?? true;
        const drawLeft = borders?.left ?? true;
        const drawRight = borders?.right ?? true;

        doc.setDrawColor(0, 0, 0);

        if (drawTop) doc.line(x, y, x + w, y);
        if (drawBottom) doc.line(x, y + h, x + w, y + h);
        if (drawLeft) doc.line(x, y, x, y + h);
        if (drawRight) doc.line(x + w, y, x + w, y + h);

        // ---------------------------

        // Alignement texte
        let textX = x + w / 2;
        if (align === "left") textX = x + 2;
        if (align === "right") textX = x + w - 2;
        const safeText = text == null ? "" : String(text);
        doc.text(safeText, textX, y + h / 2, { align, baseline: "middle" });
      }

      const generalYearMaxima = calculateBulletinYearMaxima(generalMaxima);
      const generalesMaximaSem1P1 = generalMaxima.p1 ?? 0;
      const generalesMaximaSem1P2 = generalMaxima.p2 ?? 0;
      const generalesMaximaTot1 = generalYearMaxima.semester1.total;
      const generalesMaximaSem2P3 = generalMaxima.p3 ?? 0;
      const generalesMaximaSem2P4 = generalMaxima.p4 ?? 0;
      const generalesMaximaTot2 = generalYearMaxima.semester2.total;

      blocs.forEach((bloc) => {
        if (bloc.subjects.length === 0) return;
        const isGeneraux = bloc.isGeneraux === true;
        // Récupérer les colonnes actives pour la période
        let filteredPeriodKeys = [...activePeriodKeys];
        const yearMaxima = calculateBulletinYearMaxima(bloc.maxima);
        const maximaSem1P1 = bloc.maxima.p1 ?? 0;
        const maximaSem1P2 = bloc.maxima.p2 ?? 0;
        const maximaExam1 = bloc.maxima.exam1 ?? 0;
        const maximaTot1 = yearMaxima.semester1.total;
        const maximaSem2P3 = bloc.maxima.p3 ?? 0;
        const maximaSem2P4 = bloc.maxima.p4 ?? 0;
        const maximaExam2 = bloc.maxima.exam2 ?? 0;
        const maximaTot2 = yearMaxima.semester2.total;
        const maximaTG = yearMaxima.annualTotal;
        // **Définition des positions X pour les colonnes**
        const totX1 = colPos[1] + shiftX + sem1SubWidths[0]; // colonne EXAM sem1
        const examX1 = totX1 + sem1SubWidths[1]; // colonne TOT sem1
        const totX2 = colPos[2] + shiftX + sem2SubWidths[0]; // colonne EXAM sem2
        const examX2 = totX2 + sem2SubWidths[1]; // colonne TOT sem2

        // --- DESSIN DES MAXIMA ---
        drawCell1(
          doc,
          colPos[0] + shiftX,
          yPosBlocs,
          colWidths[0],
          maximaHeight,
          `MAXIMA ${bloc.blocName.toUpperCase()}`,
          { isMaxima: true, align: "left" },
        );

        // Dessiner les semestres
        drawSemesterRow1(
          doc,
          yPosBlocs,
          {
            p1: maximaSem1P1,
            p2: maximaSem1P2,
            exam1: maximaExam1,
            tt1: maximaTot1,
          },
          {
            p3: maximaSem2P3,
            p4: maximaSem2P4,
            exam2: maximaExam2,
            tt2: maximaTot2,
          },
          {
            colPos,
            shiftX,
            sem1PeriodWidths,
            sem2PeriodWidths,
            sem1SubWidths,
            sem2SubWidths,
            totX1,
            totX2,
            examX1,
            examX2,
            maximaHeight,
          },
        );

        // --- TG et colonnes vides ---
        const tgX = colPos[3] + shiftX;
        drawCell1(
          doc,
          tgX,
          yPosBlocs,
          colWidths[3],
          maximaHeight,
          maximaTG.toString(),
          { isMaxima: true },
        );

        // Colonnes vides
        for (let i = 4; i <= 6; i++) {
          const width = i === 6 ? 34.1 : colWidths[i]; // dernier = largeur fixe
          drawCell1(
            doc,
            colPos[i] + shiftX,
            yPosBlocs,
            width,
            maximaHeight,
            "",
            {
              isMaxima: true,
            },
          );
        }
        yPosBlocs += maximaHeight;

        bloc.subjects.forEach((subject) => {
          // === CAS SPÉCIAL : BLOC GENERAUX & MATIÈRE "TOTAUX" ===
          if (isGeneraux && generauxConfig[subject.name]) {
            const config = generauxConfig[subject.name];
            drawSubjectRow(
              drawCell,
              yPosBlocs,
              shiftX,
              colPos,
              colWidths,
              sem1PeriodWidths,
              sem2PeriodWidths,
              sem1SubWidths,
              sem2SubWidths,
              totX1,
              examX1,
              totX2,
              examX2,
              maximaHeight,
              { name: subject.name },
              autresByPeriod,
              generalesMaximaSem1P1,
              generalesMaximaSem1P2,
              generalesMaximaTot1,
              generalesMaximaSem2P3,
              generalesMaximaSem2P4,
              generalesMaximaTot2,
              config.getColor,
              safeStr,
              config.isGeneraux,
            );

            return (yPosBlocs += maximaHeight);
          }
          // Toujours inclure sem1
          const sem1Keys = ["p1", "p2", "exam1"];
          // Ajouter sem2 selon la période
          if (selectedPeriod === "3tr Period" || selectedPeriod === "3e Periode") {
            filteredPeriodKeys = [...sem1Keys, "p3"]; // sem1 + p3 seulement
          } else if (selectedPeriod === "4th Period" || selectedPeriod === "4e Periode") {
            filteredPeriodKeys = [...sem1Keys, "p3", "p4"];
          } else if (
            selectedPeriod === "Exam 2nd semester" ||
            selectedPeriod === "Examen 2e semestre" ||
            selectedPeriod === "Examen 2e trimestre"
          ) {
            filteredPeriodKeys = [...sem1Keys, "p3", "p4", "exam2"]; // sem1 + sem2 complet
          } else {
            // pour les autres périodes, on garde ce qui est dans activePeriodKeys
            filteredPeriodKeys = activePeriodKeys;
          }
          const getColorText = (
            value: number,
            type: string,
            max: number,
          ): string => {
            if (!max || max === 0) return "black"; // éviter division par 0
            return value < max / 2 ? "red" : "black";
          };

          drawMatiere(
            drawCell,
            yPosBlocs,
            shiftX,
            colPos,
            colWidths,
            sem1PeriodWidths,
            sem2PeriodWidths,
            sem1SubWidths,
            sem2SubWidths,
            totX1,
            examX1,
            totX2,
            examX2,
            maximaHeight,
            subject, // matière
            activePeriodKeys,
            getColorText,
            computeTotSem1,
            computeTotSem2,
            canShowTot1,
            canShowTot2,
            maximaTot1,
            maximaTot2,
            maximaTG,
          );
          yPosBlocs += maximaHeight; // incrémente même si score = 0
        });
      });
    });

    const pdfBlob = doc.output("blob");
    const url = URL.createObjectURL(pdfBlob);
    setPdfUrl(url);
    return url;
  }, [imageData1, imageData2, data, branchContext]);
  return (
    <div className="flex flex-col gap-4">
      {imageData1 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant={variant} size={size} onClick={generatePDF}>
              {label ? label : <FaEye className="text-red-600" />}
            </Button>
          </PopoverTrigger>

          {/* Contenu centré comme modal */}
          {open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <PopoverContent className="relative w-[80vw] max-w-[800px] h-[80vh]">
                {/* Bouton X de fermeture */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="absolute top-2 right-2 text-gray-600 hover:text-gray-900"
                >
                  <FaTimes />
                </Button>

                {loading ? (
                  <p className="text-gray-500 text-center mt-20">
                    Génération du PDF...
                  </p>
                ) : pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    className="w-full h-full border"
                    title="Preview PDF"
                  />
                ) : (
                  <p className="text-gray-500 text-center mt-20">
                    Cliquez sur View pour générer le PDF.
                  </p>
                )}
              </PopoverContent>
            </div>
          )}
        </Popover>
      )}
    </div>
  );
}
