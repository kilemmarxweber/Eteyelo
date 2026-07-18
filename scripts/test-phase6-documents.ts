import assert from "node:assert/strict";
import jsPDF from "jspdf";

import {
  createAttestationPdfOutput,
  generateAttestationPdf,
} from "../lib/pdf/attestation-layout";
import {
  createBrevetPdfOutput,
  generateBrevetPdf,
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

test("createBrevetPdfOutput genere un document valide", () => {
  const output = createBrevetPdfOutput({
    organizationName: "Org Test",
    branchName: "Centre Test",
    studentName: "Jean Dupont",
    brevetNumber: "CF-2026-0001",
    programmeName: "Informatique",
    sessionName: "Session A",
  });

  assert.ok(output.blob.size > 0);
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
