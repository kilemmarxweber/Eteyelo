"use server";

import { revalidatePath } from "next/cache";

import { attachPdfToIssuedDocument } from "@/lib/issued-document-server";
import { getCurrentBranch } from "../student/student.action";

export async function attachIssuedDocumentPdfAction(input: {
  documentId: string;
  pdfBase64: string;
  baseName: string;
}) {
  const { branchId, organizationId, canIssueDocuments } = await getCurrentBranch();

  if (!canIssueDocuments) {
    return { ok: false as const, message: "Action non autorisee" };
  }

  if (!input.pdfBase64?.trim()) {
    return { ok: false as const, message: "PDF manquant" };
  }

  try {
    const saved = await attachPdfToIssuedDocument({
      documentId: input.documentId,
      branchId,
      pdfBase64: input.pdfBase64,
      baseName: input.baseName,
    });

    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/brevets`,
    );
    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/releves`,
    );
    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/attestations`,
    );

    return { ok: true as const, pdfUrl: saved.url };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Enregistrement impossible",
    };
  }
}
