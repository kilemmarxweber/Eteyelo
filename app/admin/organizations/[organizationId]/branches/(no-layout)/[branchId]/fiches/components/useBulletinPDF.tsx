"use client";

import { useCallback, useEffect, useState } from "react";
import jsPDF, { GState } from "jspdf";
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
  drawMatiere,
  generauxConfig,
  mapTypeFicheSectionToSubject,
} from "@/lib/types";
import {
  buildEmptySubjectGroupScores,
  getAcademicPeriodOrder,
  getActivePeriodKeys,
} from "@/lib/academic-structure";
import type { BulletinBranchContext } from "@/lib/bulletin-context";
import { resolveBulletinLayoutKind } from "@/lib/bulletin-context";
import {
  aggregateBulletinPeriodMaxima,
  calculateBulletinYearMaxima,
  compareBulletinRepresentativePeriodMaxima,
  getBulletinGroupMaxima,
  getBulletinRepresentativePeriodMax,
  isValidBulletinMaxScore,
  type BulletinPeriodMaxima,
} from "@/lib/bulletin-maxima";
import {
  BULLETIN_INNER_LINE_WIDTH_MM,
  BULLETIN_OUTER_LINE_WIDTH_MM,
} from "@/lib/bulletin-layout";
import {
  buildSecondaryBulletinLayout,
  drawSecondaryTableHeader,
  getSecondarySemesterDrawConfig,
} from "./bulletin-secondary-layout";
import {
  buildPrimaryBulletinRows,
  getPrimarySubjectCanonicalKey,
  getPrimarySubjectDisplayName,
  type PrimaryDomainCode,
} from "@/lib/primary-domains";
import {
  dedupeBulletinSubjectsByName,
  normalizeBulletinSubjectKey,
} from "@/lib/bulletin-subjects";
import {
  buildPrimaryBulletinLayout,
  drawPrimaryTableHeader,
  type PrimaryBulletinLayout,
} from "./bulletin-primary-layout";
import {
  buildGenerauxCellValues,
  buildPrimaryDomainPtsByCell,
  buildPrimaryMaximaValues,
  drawPrimaryDomainHeader,
  drawPrimaryGeneralMaximaRow,
  drawPrimaryMatiere,
  drawPrimarySectionHeader,
  drawPrimarySousTotalRow,
  drawPrimarySubjectRow,
} from "./bulletin-primary-render";
import {
  drawSecondaryDecisionSidebar,
  drawSecondaryFooterBlock,
  redrawSecondaryMainFrameBorder,
  type SecondaryDecisionSidebarParams,
} from "./bulletin-secondary-footer";
import { drawSecondarySubjectRow } from "./bulletin-secondary-render";

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
  classCode,
  classLevel,
  classOptionName,
  schoolYear,
}: {
  data: any[];
  branchContext: BulletinBranchContext;
  label?: string;
  variant?: any;
  size?: any;
  /** Code classe (ex. codeClasse) */
  classCode?: string;
  /** Niveau / degré (ex. Degré moyen) */
  classLevel?: string | null;
  /** Option de la classe (ex. Biologie-Chimie) */
  classOptionName?: string | null;
  /** Libellé année scolaire en cours */
  schoolYear?: string;
}) {
  const [imageData1, setImageData1] = useState<string | null>(null);
  const [imageData2, setImageData2] = useState<string | null>(null);
  const [watermarkData, setWatermarkData] = useState<string | null>(null);
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
  useEffect(() => {
    fetch("/uploads/Armoiri_de_la_RDC.png")
      .then((res) => {
        if (!res.ok) throw new Error(`Armoirie watermark HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => getImageBase64(new File([blob], "Armoiri_de_la_RDC.png")))
      .then((base64) => setWatermarkData(base64))
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

    const layoutKind = resolveBulletinLayoutKind(branchContext.branchType);
    const isPrimaryLayout = layoutKind === "primary";

    const shiftX = 0;
    const shiftY = isPrimaryLayout ? -25 : -25;
    const tableX = margin;
    // Primaire : titre + BRANCHES un peu plus bas (compromis place / aération)
    // Secondaire : tableau légèrement remonté (compromis titres / lignes de cours)
    const tableY = isPrimaryLayout ? margin + 85 : margin + 84;

    const rowHeightTotal = isPrimaryLayout ? 10 : 20;
    const hTop = isPrimaryLayout ? 5 : 7;
    const hMid = isPrimaryLayout ? 5 : 7;
    const hBottom = isPrimaryLayout ? 0 : 7;

    const secondaryLayout = isPrimaryLayout
      ? null
      : buildSecondaryBulletinLayout({
          pageWidth,
          margin,
          tableX,
          tableY,
          shiftX,
          shiftY,
          rowHeightTotal,
          hTop,
          hMid,
          hBottom,
        });

    const primaryLayout: PrimaryBulletinLayout | null = isPrimaryLayout
      ? buildPrimaryBulletinLayout({
          pageWidth,
          margin,
          tableX,
          tableY,
          shiftX,
          shiftY,
          rowHeightTotal,
          hTop,
          hMid,
          hBottom,
        })
      : null;

    const layout = isPrimaryLayout ? primaryLayout! : secondaryLayout!;
    const {
      colWidths,
      colPos,
    } = layout;
    const repechageWidth = secondaryLayout?.repechageWidth ?? 0;
    const secondarySpacerWidth = secondaryLayout?.spacerWidth ?? 0;
    const sem1SubWidths = isPrimaryLayout ? [] : secondaryLayout!.sem1SubWidths;
    const sem2SubWidths = isPrimaryLayout ? [] : secondaryLayout!.sem2SubWidths;
    const sem1PeriodWidths = isPrimaryLayout ? [] : secondaryLayout!.sem1PeriodWidths;
    const sem2PeriodWidths = isPrimaryLayout ? [] : secondaryLayout!.sem2PeriodWidths;
    const totX1 = isPrimaryLayout ? 0 : secondaryLayout!.totX1;
    const examX1 = isPrimaryLayout ? 0 : secondaryLayout!.examX1;
    const totX2 = isPrimaryLayout ? 0 : secondaryLayout!.totX2;
    const examX2 = isPrimaryLayout ? 0 : secondaryLayout!.examX2;

    doc.setDrawColor(0);
    doc.setLineWidth(BULLETIN_OUTER_LINE_WIDTH_MM);

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
      // Primaire : ne pas remonter le bloc ministère (sinon collé au N° ID)
      const headerContentLift = 0;
      doc.addImage(
        imageData1,
        "PNG",
        margin + 3,
        margin + 3 - headerContentLift,
        28,
        17,
      );
      doc.addImage(
        imageData2,
        "PNG",
        margin + frameWidth - 21,
        margin + 3 - headerContentLift,
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
          margin + 8 - headerContentLift + i * 6,
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
        size: number = 5,
        count: number = 8,
        spacing: number = 0, // 0 = grille continue (pas de double trait entre cases)
        value: string = "",
      ) {
        const chars = String(value ?? "")
          .toUpperCase()
          .replace(/\s+/g, "")
          .split("");

        const step = size + spacing;
        const totalW = count * size + Math.max(0, count - 1) * spacing;

        doc.saveGraphicsState();
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(BULLETIN_INNER_LINE_WIDTH_MM);

        if (spacing <= 0) {
          // Une seule bande : contour + séparateurs verticaux (trait fin, sans double contour)
          doc.rect(x, y, totalW, size);
          for (let i = 1; i < count; i++) {
            const lx = x + i * size;
            doc.line(lx, y, lx, y + size);
          }
        } else {
          for (let i = 0; i < count; i++) {
            doc.rect(x + i * step, y, size, size);
          }
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(Math.max(5.5, size * 1.35));
        doc.setTextColor(0, 0, 0);
        for (let i = 0; i < count; i++) {
          const char = chars[i];
          if (!char) continue;
          const squareX = x + i * step;
          doc.text(char, squareX + size / 2, y + size * 0.72, {
            align: "center",
          });
        }
        doc.restoreGraphicsState();
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
      // En-tête compact (primaire et secondaire) pour afficher province + CODE sur 5 lignes
      const idBoxY = 33;
      const idBoxH = 7.5;
      const infoStartY = 40.5;
      const infoRowH = 4.8;
      const infoHeight = infoRowH * 5;
      const schoolLabelYs = [44.2, 49, 53.8, 58.6, 63.4];
      const studentLabelYs = [44.2, 49, 53.8, 58.6, 63.4];
      const width = layout.frameWidth;
      const leftColMaxWidth = width / 2 - 6;

      drawTwoColumnBox(startX, idBoxY, width, idBoxH, infoRowH, false);
      drawLabel("N° ID.", 22, 38.5, {
        size: 9,
        bold: true,
        align: "right",
      });
      drawHorizontalSquares(25, 35, 4, 27, 0);
      drawTwoColumnBox(startX, infoStartY, width, infoHeight, infoRowH);

      const schoolName = branchContext.branchName || branchContext.organizationName;
      const branchLocation = [branchContext.city, branchContext.country]
        .filter(Boolean)
        .join(" / ");
      const schoolNameSecondary = branchContext.organizationName
        ? `${branchContext.branchName} — ${branchContext.organizationName}`
        : branchContext.branchName;

      if (isPrimaryLayout) {
        drawLabel(
          `PROVINCE EDUCATIONNELLE : ${branchContext.province || "………………"}`,
          12,
          schoolLabelYs[0],
          { size: 7.5, bold: true, align: "left", maxWidth: leftColMaxWidth },
        );
        drawLabel(
          `VILLE : ${branchContext.city || "………………"}`,
          12,
          schoolLabelYs[1],
          { size: 7.5, bold: true, align: "left", maxWidth: leftColMaxWidth },
        );
        drawLabel(
          `COMMUNE / TER. (1) : ${branchContext.commune || "………………"}`,
          12,
          schoolLabelYs[2],
          { size: 7.5, bold: true, align: "left", maxWidth: leftColMaxWidth },
        );
        drawLabel(
          `ECOLE : ${schoolName || "………………"}`,
          12,
          schoolLabelYs[3],
          { size: 7.5, bold: true, align: "left", maxWidth: leftColMaxWidth },
        );
        drawLabel("CODE :", 12, schoolLabelYs[4], {
          size: 7.5,
          bold: true,
          align: "left",
        });
        const schoolCode = branchContext.branchCode.replace(/\s+/g, "");
        const codeBoxCount = Math.min(16, Math.max(12, schoolCode.length || 12));
        drawHorizontalSquares(
          28,
          infoStartY + infoRowH * 4 + 0.55,
          3.6,
          codeBoxCount,
          0,
          schoolCode,
        );
      } else {
        drawLabel(
          `PROVINCE EDUCATIONNELLE : ${branchContext.province || "………………"}`,
          12,
          schoolLabelYs[0],
          { size: 7.5, bold: true, align: "left", maxWidth: leftColMaxWidth },
        );
        drawLabel(`VILLE / PAYS : ${branchLocation || "-"}`, 12, schoolLabelYs[1], {
          size: 7.5,
          bold: true,
          align: "left",
          maxWidth: leftColMaxWidth,
        });
        drawLabel(`ADRESSE : ${branchContext.address || "-"}`, 12, schoolLabelYs[2], {
          size: 7.5,
          bold: true,
          align: "left",
          maxWidth: leftColMaxWidth,
        });
        drawLabel(`ECOLE : ${schoolNameSecondary || "-"}`, 12, schoolLabelYs[3], {
          size: 7.5,
          bold: true,
          align: "left",
          maxWidth: leftColMaxWidth,
        });
        drawLabel("CODE :", 12, schoolLabelYs[4], {
          size: 7.5,
          bold: true,
          align: "left",
        });
        const schoolCode = (branchContext.branchCode || "").replace(/\s+/g, "");
        const codeBoxCount = Math.min(16, Math.max(12, schoolCode.length || 12));
        drawHorizontalSquares(
          28,
          infoStartY + infoRowH * 4 + 0.55,
          3.6,
          codeBoxCount,
          0,
          schoolCode,
        );
      }
      //Information Students
      drawLabel(
        `Eleve        :        ${student.nom?.toUpperCase() ?? ""} ${
          student.studentSurname?.toUpperCase() ?? ""
        }       SEXE : ${student.studentSexe?.toUpperCase() ?? ""}`,
        110,
        studentLabelYs[0],
        {
          size: 7.5,
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
        isPrimaryLayout
          ? `Né à        :                         ${formattedDate}`
          : `Né à        :       MONT-NGAFULA             ${formattedDate} `,
        110,
        studentLabelYs[1],
        {
          size: 7.5,
          bold: true,
          align: "left",
        },
      );
      drawLabel(
        `CLASSE :       ${student.studentclasse ?? "Non spécifiée"} `,
        110,
        studentLabelYs[2],
        {
          size: 7.5,
          bold: true,
          align: "left",
        },
      );
      drawLabel("N° PERM:  ", 110, studentLabelYs[3], {
        size: 7.5,
        bold: true,
        align: "left",
      });
      drawHorizontalSquares(
        132,
        infoStartY + infoRowH * 3 + 0.55,
        3.6,
        13,
        0,
        student.studentusername ?? "",
      );
      function generatePrimaryFooterBlock(
        frameX: number,
        frameY: number,
        frameW: number,
        frameH: number,
      ): void {
        doc.saveGraphicsState();

        const padX = 6;
        const padBottom = 3;
        const startX = frameX + padX;
        const contentW = frameW - padX * 2;
        const frameBottom = frameY + frameH;
        const lineHeight = 5.5;

        const notesY2 = frameBottom - padBottom;
        const notesY1 = notesY2 - lineHeight;

        doc.setFont("Times", "Bold");
        doc.setFontSize(8);
        doc.text("(1) Biffer la mention inutile", startX, notesY1);
        doc.text(
          "Note importante : le bulletin est sans valeur s’il est raturé ou surchargé.",
          startX,
          notesY2,
        );

        const sigY = notesY1 - lineHeight * 1.4;
        doc.setFont("Times", "Bold");
        doc.setFontSize(8);
        doc.text("Sceau de l’Ecole", startX + contentW / 2, sigY, {
          align: "center",
        });
        doc.text("Le Chef d’Etablissement", startX + contentW, sigY, {
          align: "right",
        });
        doc.setFont("Times", "Normal");
        doc.setFontSize(7);
        doc.text("Nom et signature", startX + contentW, sigY + 4, {
          align: "right",
        });

        doc.restoreGraphicsState();
      }

      if (isPrimaryLayout) {
        generatePrimaryFooterBlock(margin, margin, frameWidth, headerHeight);
      }

      const resolvedClassCode =
        classCode?.trim() ||
        student.studentclasse?.trim() ||
        "—";
      const resolvedOptionName = (classOptionName?.trim() || "")
        .replace(/-/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const bulletinClassLabel = resolvedOptionName
        ? `${resolvedClassCode}(${resolvedOptionName})`
        : resolvedClassCode;
      const resolvedYear =
        schoolYear?.trim() ||
        student.periods.find((p: { anneeName?: string }) => p.anneeName)?.anneeName ||
        "—";
      const degreeLabel =
        classLevel?.trim() ||
        (isPrimaryLayout ? "Degre moyen" : student.studentclasse?.trim() || "—");

      const tableTopY = tableY + shiftY;
      const bulletinTitleY = isPrimaryLayout
        ? tableTopY - 0.5
        : tableTopY - 0.6;
      const toBulletinUpper = (value: string) =>
        value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toUpperCase();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text(
        toBulletinUpper(
          isPrimaryLayout
            ? `Bulletin de l'élève ${degreeLabel} (${resolvedClassCode})`
            : `Bulletin de l'élève ${bulletinClassLabel}`,
        ),
        margin + 1,
        bulletinTitleY,
        { align: "left", baseline: "bottom" },
      );
      doc.text(
        toBulletinUpper(`ANNEE SCOLAIRE ${resolvedYear}`),
        margin + frameWidth - 1,
        bulletinTitleY,
        { align: "right", baseline: "bottom" },
      );

      if (isPrimaryLayout) {
        drawPrimaryTableHeader(doc, primaryLayout!);
      } else {
        drawSecondaryTableHeader(doc, secondaryLayout!);
      }

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
      const activePeriodKeys = getActivePeriodKeys(
        selectedPeriod,
        branchContext.branchType,
      );

      if (activePeriodKeys.length === 0) {
        throw new Error(`Période inconnue: ${selectedPeriod}`);
      }
      // --- Generate the subject map ---
      type SubjectWithMaxima = Subject & {
        maxima: BulletinPeriodMaxima;
        primaryDomain?: PrimaryDomainCode | null;
        primarySection?: string | null;
        domainOrder?: number | null;
      };
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
      const emptyGroupScores = buildEmptySubjectGroupScores(
        branchContext.branchType,
      );

      const ensureSubject = (
        rawName: string,
        meta?: {
          primaryDomain?: string | null;
          primarySection?: string | null;
          domainOrder?: number | null;
        },
      ): SubjectWithMaxima => {
        const key = isPrimaryLayout
          ? getPrimarySubjectCanonicalKey(rawName)
          : normalizeBulletinSubjectKey(rawName);
        const displayName = isPrimaryLayout
          ? getPrimarySubjectDisplayName(rawName)
          : rawName.trim();
        if (!subjectMap[key]) {
          // Cloner les scores vides : sinon toutes les matières partagent
          // les mêmes objets sem1/sem2/sem3 et s'écrasent mutuellement.
          subjectMap[key] = {
            name: displayName,
            sem1: { ...(emptyGroupScores.sem1 ?? {}) },
            sem2: { ...(emptyGroupScores.sem2 ?? {}) },
            ...(emptyGroupScores.sem3
              ? { sem3: { ...emptyGroupScores.sem3 } }
              : {}),
            baseMaxScore: 0,
            maxima: {},
            primaryDomain: (meta?.primaryDomain as PrimaryDomainCode | null) ?? null,
            primarySection: meta?.primarySection ?? null,
            domainOrder: meta?.domainOrder ?? null,
          };
        } else if (meta?.primaryDomain && !subjectMap[key].primaryDomain) {
          subjectMap[key].primaryDomain = meta.primaryDomain as PrimaryDomainCode;
          subjectMap[key].primarySection = meta.primarySection ?? null;
          subjectMap[key].domainOrder = meta.domainOrder ?? null;
        }
        return subjectMap[key];
      };

      student.periods.forEach((period: StudentPeriod) => {
        Object.entries(period.notes || {}).forEach(([rawName, note]) => {
          ensureSubject(rawName, {
            primaryDomain: (note as { primaryDomain?: string | null }).primaryDomain,
            primarySection: (note as { primarySection?: string | null }).primarySection,
            domainOrder: (note as { domainOrder?: number | null }).domainOrder,
          });
        });
      });

      student.periods.forEach((period: StudentPeriod) => {
        const periodKey = periodKeyMap[period.periodName as PeriodLabel];
        if (!periodKey) return;

        const semester = periodKeyDefinitions[periodKey];
        if (!semester) return;

        Object.entries(period.notes || {}).forEach(([subjectName, note]) => {
          const subject = ensureSubject(subjectName, {
            primaryDomain: (note as { primaryDomain?: string | null }).primaryDomain,
            primarySection: (note as { primarySection?: string | null }).primarySection,
            domainOrder: (note as { domainOrder?: number | null }).domainOrder,
          });

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
              .slice(0, 6)
              .map(([key, value]) =>
                mapTypeFicheSectionToSubject(value as BlocValue, key),
              )
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

      const uniqueSubjects = isPrimaryLayout
        ? Object.values(subjectMap)
        : dedupeBulletinSubjectsByName(Object.values(subjectMap));

      uniqueSubjects.forEach((subject) => {
        const signature = periodSignatureKeys
          .map((key) => subject.maxima[key] ?? 0)
          .join(":");
        const existingBloc = courseBlocsMap.get(signature);

        if (existingBloc) {
          const alreadyPresent = existingBloc.subjects.some(
            (s) =>
              normalizeBulletinSubjectKey(s.name) ===
              normalizeBulletinSubjectKey(subject.name),
          );
          if (!alreadyPresent) {
            existingBloc.subjects.push(subject);
          }
          return;
        }

        const representativeMax = getBulletinRepresentativePeriodMax(
          subject.maxima,
          subject.baseMaxScore,
        );

        courseBlocsMap.set(signature, {
          blocName:
            representativeMax > 0 ? String(representativeMax) : "",
          subjects: [subject],
          maxima: subject.maxima,
        });
      });

      const sortedCourseBlocs = [...courseBlocsMap.values()]
        .map((bloc) => ({
          ...bloc,
          subjects: [...bloc.subjects].sort((a, b) => {
            const maxDiff = compareBulletinRepresentativePeriodMaxima(
              (a as SubjectWithMaxima).maxima,
              (b as SubjectWithMaxima).maxima,
              a.baseMaxScore,
              b.baseMaxScore,
            );
            if (maxDiff !== 0) return maxDiff;
            return a.name.localeCompare(b.name, "fr");
          }),
        }))
        .sort((a, b) =>
          compareBulletinRepresentativePeriodMaxima(
            a.maxima,
            b.maxima,
            a.subjects[0]?.baseMaxScore ?? 0,
            b.subjects[0]?.baseMaxScore ?? 0,
          ),
        );

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

      const subjectMaxima = uniqueSubjects.map((subject) => subject.maxima);
      const generalMaxima = aggregateBulletinPeriodMaxima(subjectMaxima);
      const primaryRows = isPrimaryLayout
        ? buildPrimaryBulletinRows(uniqueSubjects)
        : [];
      const blocs: DynamicBloc[] = isPrimaryLayout
        ? [
            {
              blocName: "GENERAUX",
              // Primaire : pas de ligne TOTAUX — les totaux vont sur MAXIMA GÉNÉRAL (colonnes PTS OBT).
              subjects: typeDSubjects.filter((s) => s.name !== "TOTAUX"),
              maxima: generalMaxima,
              isGeneraux: true,
            },
          ]
        : [
            ...sortedCourseBlocs,
            {
              blocName: "GENERAUX",
              subjects: typeDSubjects,
              maxima: generalMaxima,
              isGeneraux: true,
            },
          ];
      // Hauteur des lignes
      const maximaHeight = isPrimaryLayout ? 4.5 : 5;
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
          | {
              text?: string;
              fill?: string;
              bold?: boolean;
              fontSize?: number;
              hatch?: "dashed";
            } = "black",

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
        let useBold = false;
        let fontSize = isPrimaryLayout ? 6.5 : 8;
        let hatchDashed = false;

        if (typeof color === "string") {
          if (palette[color]) textColor = palette[color];
        } else {
          if (color.text && palette[color.text])
            textColor = palette[color.text];
          if (color.fill && palette[color.fill])
            fillColor = palette[color.fill];
          if (color.bold) useBold = true;
          if (typeof color.fontSize === "number") fontSize = color.fontSize;
          if (color.hatch === "dashed") hatchDashed = true;
        }

        // Maxima = noir/blanc
        if (isMaxima) {
          doc.setFillColor(0, 0, 0);
          doc.setTextColor(255, 255, 255);
          useBold = true;
        } else {
          doc.setFillColor(...fillColor);
          doc.setTextColor(...textColor);
        }

        // 🧱 Dessiner le fond
        doc.rect(x, y, w, h, "F");

        // Motif tirets diagonaux (CONDUITE) — densifiés pour un rendu « qui colle »
        if (hatchDashed && !isMaxima) {
          doc.saveGraphicsState();
          doc.setDrawColor(40, 40, 40);
          doc.setLineWidth(0.18);
          doc.setLineDashPattern([1.05, 0.28], 0);
          const step = 1.05;
          for (let offset = -h; offset <= w + h; offset += step) {
            doc.line(x + offset, y, x + offset + h, y + h);
          }
          doc.setLineDashPattern([], 0);
          doc.restoreGraphicsState();
        }

        // ---------------------------------
        // ⭐ Gestion des 4 bordures
        // ---------------------------------

        const drawTop = borders?.top ?? true;
        const drawBottom = borders?.bottom ?? true;
        const drawLeft = borders?.left ?? true;
        const drawRight = borders?.right ?? true;

        doc.saveGraphicsState();
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(BULLETIN_INNER_LINE_WIDTH_MM);

        if (drawTop) doc.line(x, y, x + w, y);
        if (drawBottom) doc.line(x, y + h, x + w, y + h);
        if (drawLeft) doc.line(x, y, x, y + h);
        if (drawRight) doc.line(x + w, y, x + w, y + h);

        doc.restoreGraphicsState();

        // ---------------------------

        // Alignement texte
        let textX = x + w / 2;
        if (align === "left") textX = x + 2;
        if (align === "right") textX = x + w - 2;
        const safeText = text == null ? "" : String(text);
        doc.setFont("helvetica", useBold ? "bold" : "normal");
        doc.setFontSize(fontSize);
        doc.text(safeText, textX, y + h / 2, { align, baseline: "middle" });
      }

      const generalYearMaxima = calculateBulletinYearMaxima(generalMaxima);
      const generalesMaximaSem1P1 = generalMaxima.p1 ?? 0;
      const generalesMaximaSem1P2 = generalMaxima.p2 ?? 0;
      const generalesMaximaTot1 =
        getBulletinGroupMaxima(generalYearMaxima, 1)?.total ?? 0;
      const generalesMaximaSem2P3 = generalMaxima.p3 ?? 0;
      const generalesMaximaSem2P4 = generalMaxima.p4 ?? 0;
      const generalesMaximaTot2 =
        getBulletinGroupMaxima(generalYearMaxima, 2)?.total ?? 0;
      const generalesMaximaSem3P5 = generalMaxima.p5 ?? 0;
      const generalesMaximaSem3P6 = generalMaxima.p6 ?? 0;
      const generalesMaximaTot3 =
        getBulletinGroupMaxima(generalYearMaxima, 3)?.total ?? 0;
      const generalesMaximaTG = generalYearMaxima.annualTotal;

      if (isPrimaryLayout) {
        const getColorText = (
          value: number,
          type: string,
          max: number,
        ): string => {
          if (!max || max === 0) return "black";
          return value < max / 2 ? "red" : "black";
        };

        for (const row of primaryRows) {
          if (row.type === "domain-header") {
            drawPrimaryDomainHeader(doc, primaryLayout!, yPosBlocs, maximaHeight, row.label);
            yPosBlocs += maximaHeight;
            continue;
          }

          if (row.type === "section-header") {
            drawPrimarySectionHeader(drawCell, primaryLayout!, yPosBlocs, maximaHeight, row.label);
            yPosBlocs += maximaHeight;
            continue;
          }

          if (row.type === "sous-total") {
            const sousTotalMaxima = buildPrimaryMaximaValues(row.maxima);
            const sousTotalPts = buildPrimaryDomainPtsByCell(
              primaryLayout!,
              row.subjects,
              activePeriodKeys,
              branchContext.branchType,
            );
            drawPrimarySousTotalRow(
              drawCell,
              primaryLayout!,
              yPosBlocs,
              maximaHeight,
              "Sous-total",
              sousTotalMaxima,
              sousTotalPts,
              getColorText,
            );
            yPosBlocs += maximaHeight;
            continue;
          }

          if (row.type === "maxima-general") {
            const generalesMaximaForTotaux = {
              p1: generalesMaximaSem1P1,
              p2: generalesMaximaSem1P2,
              exam1: generalMaxima.exam1 ?? 0,
              tt1: generalesMaximaTot1,
              p3: generalesMaximaSem2P3,
              p4: generalesMaximaSem2P4,
              exam2: generalMaxima.exam2 ?? 0,
              tt2: generalesMaximaTot2,
              p5: generalesMaximaSem3P5,
              p6: generalesMaximaSem3P6,
              exam3: generalMaxima.exam3 ?? 0,
              tt3: generalesMaximaTot3,
              tg: generalesMaximaTG,
            };
            const totauxCells = buildGenerauxCellValues(
              primaryLayout!,
              autresByPeriod,
              "TOTAUX",
              generalesMaximaForTotaux,
              false,
            );
            const totauxPtsByCell: Partial<Record<string, string>> = {};
            for (const cell of primaryLayout!.evalCells) {
              if (
                cell.kind === "period-score" ||
                cell.kind === "pts-exam" ||
                cell.kind === "pts-trim" ||
                cell.kind === "pts-total"
              ) {
                const val = totauxCells[cell.key];
                if (val) totauxPtsByCell[cell.key] = val;
              }
            }

            drawPrimaryGeneralMaximaRow(
              drawCell,
              doc,
              primaryLayout!,
              yPosBlocs,
              maximaHeight,
              buildPrimaryMaximaValues(row.maxima),
              totauxPtsByCell,
              getColorText,
            );
            yPosBlocs += maximaHeight;
            continue;
          }

          const subject = row.subject;
          const yearMaxima = calculateBulletinYearMaxima(subject.maxima, "PRIMAIRE");
          const maximaTot1 = getBulletinGroupMaxima(yearMaxima, 1)?.total ?? 0;
          const maximaTot2 = getBulletinGroupMaxima(yearMaxima, 2)?.total ?? 0;
          const maximaTot3 = getBulletinGroupMaxima(yearMaxima, 3)?.total ?? 0;
          const maximaAnnuel = yearMaxima.annualTotal;

          drawPrimaryMatiere(
            drawCell,
            yPosBlocs,
            primaryLayout!,
            maximaHeight,
            subject,
            activePeriodKeys,
            getColorText,
            branchContext.branchType,
            maximaTot1,
            maximaTot2,
            maximaTot3,
            maximaAnnuel,
          );
          yPosBlocs += maximaHeight;
        }
      }

      let secondaryDecisionSidebarDrawn = false;
      let secondaryDecisionSidebarParams: Omit<
        SecondaryDecisionSidebarParams,
        "doc"
      > | null = null;
      let secondaryTableEndY = 0;

      blocs.forEach((bloc) => {
        if (bloc.subjects.length === 0) return;
        const isGeneraux = bloc.isGeneraux === true;
        if (isPrimaryLayout && !isGeneraux) return;
        // Récupérer les colonnes actives pour la période
        let filteredPeriodKeys = [...activePeriodKeys];
        const yearMaxima = calculateBulletinYearMaxima(bloc.maxima);
        const maximaSem1P1 = bloc.maxima.p1 ?? 0;
        const maximaSem1P2 = bloc.maxima.p2 ?? 0;
        const maximaExam1 = bloc.maxima.exam1 ?? 0;
        const maximaTot1 = getBulletinGroupMaxima(yearMaxima, 1)?.total ?? 0;
        const maximaSem2P3 = bloc.maxima.p3 ?? 0;
        const maximaSem2P4 = bloc.maxima.p4 ?? 0;
        const maximaExam2 = bloc.maxima.exam2 ?? 0;
        const maximaTot2 = getBulletinGroupMaxima(yearMaxima, 2)?.total ?? 0;
        const maximaSem3P5 = bloc.maxima.p5 ?? 0;
        const maximaSem3P6 = bloc.maxima.p6 ?? 0;
        const maximaExam3 = bloc.maxima.exam3 ?? 0;
        const maximaTot3 = getBulletinGroupMaxima(yearMaxima, 3)?.total ?? 0;
        const maximaTG = yearMaxima.annualTotal;

        if (!isPrimaryLayout) {
          drawCell1(
            doc,
            colPos[0] + shiftX,
            yPosBlocs,
            colWidths[0],
            maximaHeight,
            `MAXIMA ${bloc.blocName.toUpperCase()}`,
            { isMaxima: true, align: "left" },
          );

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
            getSecondarySemesterDrawConfig(secondaryLayout!, maximaHeight),
          );

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

          for (let i = 4; i <= 6; i++) {
            const width =
              i === 6
                ? repechageWidth
                : i === 5 && secondarySpacerWidth > 0
                  ? secondarySpacerWidth
                  : colWidths[i];
            drawCell1(
              doc,
              colPos[i] + shiftX,
              yPosBlocs,
              width,
              maximaHeight,
              "",
              { isMaxima: true },
            );
          }

          yPosBlocs += maximaHeight;
        }

        bloc.subjects.forEach((subject) => {
          const getColorText = (
            value: number,
            type: string,
            max: number,
          ): string => {
            if (!max || max === 0) return "black";
            return value < max / 2 ? "red" : "black";
          };

          if (isGeneraux && generauxConfig[subject.name]) {
            const config = generauxConfig[subject.name];

            if (isPrimaryLayout) {
              yPosBlocs = drawPrimarySubjectRow(
                drawCell,
                yPosBlocs,
                primaryLayout!,
                maximaHeight,
                { name: subject.name },
                autresByPeriod,
                {
                  p1: generalesMaximaSem1P1,
                  p2: generalesMaximaSem1P2,
                  exam1: generalMaxima.exam1 ?? 0,
                  tt1: generalesMaximaTot1,
                  p3: generalesMaximaSem2P3,
                  p4: generalesMaximaSem2P4,
                  exam2: generalMaxima.exam2 ?? 0,
                  tt2: generalesMaximaTot2,
                  p5: generalesMaximaSem3P5,
                  p6: generalesMaximaSem3P6,
                  exam3: generalMaxima.exam3 ?? 0,
                  tt3: generalesMaximaTot3,
                  tg: generalesMaximaTG,
                },
                config.getColor,
                safeStr,
                true,
              );
              return;
            } else {
              if (
                subject.name === "POURCENTAGES" &&
                !secondaryDecisionSidebarDrawn
              ) {
                secondaryDecisionSidebarParams = {
                  x: colPos[6] + shiftX,
                  y: yPosBlocs - 1,
                  width: repechageWidth,
                };
                secondaryDecisionSidebarDrawn = true;
              }

              drawSecondarySubjectRow(
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
            }

            return (yPosBlocs += maximaHeight);
          }

          if (!isPrimaryLayout) {
            const sem1Keys = ["p1", "p2", "exam1"];
            if (selectedPeriod === "3tr Period" || selectedPeriod === "3e Periode") {
              filteredPeriodKeys = [...sem1Keys, "p3"];
            } else if (selectedPeriod === "4th Period" || selectedPeriod === "4e Periode") {
              filteredPeriodKeys = [...sem1Keys, "p3", "p4"];
            } else if (
              selectedPeriod === "Exam 2nd semester" ||
              selectedPeriod === "Examen 2e semestre" ||
              selectedPeriod === "Examen 2e trimestre"
            ) {
              filteredPeriodKeys = [...sem1Keys, "p3", "p4", "exam2"];
            } else {
              filteredPeriodKeys = activePeriodKeys;
            }

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
              subject,
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
          } else {
            drawPrimaryMatiere(
              drawCell,
              yPosBlocs,
              primaryLayout!,
              maximaHeight,
              subject,
              activePeriodKeys,
              getColorText,
              branchContext.branchType,
              maximaTot1,
              maximaTot2,
              maximaTot3,
              maximaTG,
            );
          }
          if (!isGeneraux || !isPrimaryLayout) {
            yPosBlocs += maximaHeight;
          }
          if (!isPrimaryLayout) {
            secondaryTableEndY = yPosBlocs;
          }
        });
      });

      if (!isPrimaryLayout) {
        drawSecondaryFooterBlock({
          doc,
          frameX: margin,
          frameY: margin,
          frameW: frameWidth,
          frameH: headerHeight,
          city: branchContext.city?.trim() || undefined,
          tableEndY: secondaryTableEndY,
        });
        if (secondaryDecisionSidebarParams) {
          const { x, y, width } = secondaryDecisionSidebarParams;
          drawSecondaryDecisionSidebar({ doc, x, y, width });
        }
        redrawSecondaryMainFrameBorder(
          doc,
          margin,
          margin,
          frameWidth,
          headerHeight,
        );
      }

      // Filigrane armoirie RDC — centré, léger, par-dessus le contenu
      if (watermarkData) {
        const pageHeight = doc.internal.pageSize.getHeight();
        const wmSize = 130;
        const wmX = (pageWidth - wmSize) / 2;
        const wmY = (pageHeight - wmSize) / 2 - 5;
        doc.setGState(new GState({ opacity: 0.1 }));
        doc.addImage(watermarkData, "PNG", wmX, wmY, wmSize, wmSize);
        doc.setGState(new GState({ opacity: 1 }));
      }
    });

    const pdfBlob = doc.output("blob");
    const url = URL.createObjectURL(pdfBlob);
    setPdfUrl(url);
    return url;
  }, [imageData1, imageData2, watermarkData, data, branchContext, classCode, classLevel, classOptionName, schoolYear]);
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
                  className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                >
                  <FaTimes />
                </Button>

                {loading ? (
                  <p className="mt-20 text-center text-sm text-muted-foreground">
                    Génération du PDF…
                  </p>
                ) : pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    className="h-full w-full rounded-md border"
                    title="Aperçu du bulletin PDF"
                  />
                ) : (
                  <p className="mt-20 text-center text-sm text-muted-foreground">
                    Cliquez sur le bouton pour générer le PDF.
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
