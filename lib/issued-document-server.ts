import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import type { IssuedDocumentType } from "@/prisma/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getUploadDirectory } from "@/lib/upload-file.server";

function sanitizeBaseName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export async function saveIssuedDocumentPdfBuffer(params: {
  buffer: Buffer;
  baseName: string;
}) {
  const uploadDirectory = getUploadDirectory();
  await fs.mkdir(uploadDirectory, { recursive: true });

  const fileName = `${Date.now()}-${crypto.randomUUID()}-${sanitizeBaseName(params.baseName)}.pdf`;
  const filePath = path.join(uploadDirectory, fileName);
  await fs.writeFile(filePath, params.buffer);

  return {
    fileName,
    url: `/api/uploads/${encodeURIComponent(fileName)}`,
  };
}

export async function attachPdfToIssuedDocument(params: {
  documentId: string;
  branchId: string;
  pdfBase64: string;
  baseName: string;
}) {
  const document = await prisma.issuedDocument.findFirst({
    where: { id: params.documentId, branchId: params.branchId },
    select: { id: true },
  });

  if (!document) {
    throw new Error("Document introuvable");
  }

  const buffer = Buffer.from(params.pdfBase64, "base64");
  const saved = await saveIssuedDocumentPdfBuffer({
    buffer,
    baseName: params.baseName,
  });

  await prisma.issuedDocument.update({
    where: { id: params.documentId },
    data: { pdfUrl: saved.url },
  });

  return saved;
}

type DuplicateCheckInput = {
  branchId: string;
  studentId: string;
  schoolYearId?: string | null;
  documentType: IssuedDocumentType;
  metadata?: Record<string, unknown>;
};

export async function findDuplicateIssuedDocument(input: DuplicateCheckInput) {
  const candidates = await prisma.issuedDocument.findMany({
    where: {
      branchId: input.branchId,
      studentId: input.studentId,
      documentType: input.documentType,
      ...(input.schoolYearId ? { schoolYearId: input.schoolYearId } : {}),
    },
    orderBy: { issuedAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      issuedAt: true,
      metadata: true,
      pdfUrl: true,
    },
  });

  if (!input.metadata) {
    return candidates[0] ?? null;
  }

  return (
    candidates.find((document) => {
      if (!document.metadata || typeof document.metadata !== "object") {
        return false;
      }

      const metadata = document.metadata as Record<string, unknown>;
      return Object.entries(input.metadata ?? {}).every(([key, value]) => {
        return metadata[key] === value;
      });
    }) ?? null
  );
}

export function duplicateDocumentMessage(title: string) {
  return `Un document similaire existe deja : « ${title} ».`;
}
