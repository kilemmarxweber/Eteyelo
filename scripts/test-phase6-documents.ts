import assert from "node:assert/strict";
import jsPDF from "jspdf";

import {
  createAttestationPdfOutput,
  generateAttestationPdf,
} from "../lib/pdf/attestation-layout";
import {
  createBrevetPdfOutputSync,
  generateBrevetPdf,
  buildCertificateParagraphsForTest,
} from "../lib/pdf/brevet-layout";
import {
  finalizePdfDocument,
  safePdfFilePart,
} from "../lib/pdf/pdf-engine";
import { createReleveNotesPdfOutput } from "../lib/pdf/releve-notes-layout";
import { createUniversityAttestationPdfOutput } from "../lib/pdf/university-attestation-layout";
import {
  duplicateDocumentMessage,
  findDuplicateIssuedDocument,
} from "../lib/issued-document-server";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

test("pdf-engine produit un blob PDF", () => {
  const doc = new jsPDF();
  doc.text("Test", 10, 10);
  const output = finalizePdfDocument(doc, "test-document.pdf");

  assert.equal(output.fileName, "test-document.pdf");
  assert.equal(output.blob.type, "application/pdf");
  assert.ok(output.arrayBuffer.byteLength > 0);
});

test("safePdfFilePart nettoie les noms de fichiers", () => {
  assert.equal(safePdfFilePart("Jean-Paul Été"), "jean-paul-ete");
});

test("createBrevetPdfOutputSync genere un document valide", () => {
  const output = createBrevetPdfOutputSync({
    organizationName: "Org Test",
    branchName: "Centre de Formation Professionnelle en Agronomie (CFPA)",
    branchCity: "Kinshasa",
    studentName: "Kanioka Kanioka Elva",
    brevetNumber: "CF-2026-0001",
    programmeName: "Agronomie",
    sessionName: "Session A",
    placeOfBirth: "Kinshasa",
    dateOfBirth: new Date("1994-06-26"),
    sexe: "feminin",
    trainingStartDate: new Date("2022-03-01"),
    trainingEndDate: new Date("2022-10-11"),
  });

  assert.ok(output.blob.size > 0);
});

test("texte officiel du brevet centre de formation", () => {
  const paragraphs = buildCertificateParagraphsForTest({
    organizationName: "Org",
    branchName: "Centre de Formation Professionnelle en Agronomie (CFPA)",
    branchCity: "Kinshasa",
    studentName: "Kanioka Kanioka Elva",
    brevetNumber: "CF-2026-0001",
    programmeName: "Agronomie",
    placeOfBirth: "Kinshasa",
    dateOfBirth: new Date("1994-06-26"),
    sexe: "feminin",
    trainingStartDate: new Date("2022-03-01"),
    trainingEndDate: new Date("2022-10-11"),
  });

  assert.match(paragraphs[0], /Nous certifions que KANIOKA KANIOKA ELVA, Née à KINSHASA/);
  assert.match(paragraphs[0], /formation technique en agronomie/);
  assert.match(paragraphs[0], /01 \/ 03 \/ 2022/);
  assert.match(paragraphs[0], /11 \/ 10 \/ 2022/);
  assert.match(paragraphs[1], /L'apprenante a été évaluée sur base des Examens théoriques/);
  assert.equal(
    paragraphs[2],
    "Nous lui remettons ce document pour servir et valoir ce que de droit.",
  );
});

test("createRelevePdfOutput genere un document valide", () => {
  const output = createReleveNotesPdfOutput({
    studentId: "s1",
    studentName: "Marie Kabila",
    username: "MK001",
    auditoireName: "L3 Info",
    auditoireLevel: "L3",
    filiereName: "Informatique",
    faculteName: "Sciences",
    schoolYearName: "2025-2026",
    schoolYearId: "sy1",
    organizationName: "Universite Test",
    branchName: "Campus Principal",
    releveNumber: "UNIV-2026-RN-0001",
    semesters: [
      {
        semesterLabel: "Premier semestre (S5)",
        semesterOrder: 1,
        semesterAverage: 72.5,
        courses: [
          {
            courseId: "c1",
            courseCode: "INF101",
            courseName: "Algorithmique",
            credits: 4,
            score: 14,
            maxScore: 20,
            percentage: 70,
          },
        ],
      },
    ],
    overallAverage: 72.5,
  });

  assert.ok(output.blob.size > 0);
});

test("createAttestationPdfOutput genere un document valide", () => {
  const output = createAttestationPdfOutput({
    organizationName: "Org",
    branchName: "Atelier",
    studentName: "Paul M.",
  });

  assert.ok(output.blob.size > 0);
});

test("createUniversityAttestationPdfOutput genere un document valide", () => {
  const output = createUniversityAttestationPdfOutput({
    organizationName: "Universite",
    branchName: "Campus",
    studentName: "Alice B.",
    kind: "INSCRIPTION",
  });

  assert.ok(output.blob.size > 0);
});

test("generateAttestationPdf et generateBrevetPdf restent invocables", () => {
  assert.equal(typeof generateAttestationPdf, "function");
  assert.equal(typeof generateBrevetPdf, "function");
});

test("duplicateDocumentMessage formate le message", () => {
  assert.match(
    duplicateDocumentMessage("Brevet de formation"),
    /Brevet de formation/,
  );
});

test("findDuplicateIssuedDocument est exporte", () => {
  assert.equal(typeof findDuplicateIssuedDocument, "function");
});

console.log("\nTous les tests Phase 6 (documents PDF) sont passes.");
