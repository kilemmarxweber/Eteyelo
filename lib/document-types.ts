export const ISSUED_DOCUMENT_TYPES = [
  "BULLETIN",
  "BREVET",
  "RELEVE_NOTES",
  "ATTESTATION",
  "ATTESTATION_PARTICIPATION",
] as const;

export type ManagedDocumentType = (typeof ISSUED_DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<ManagedDocumentType, string> = {
  BULLETIN: "Bulletin scolaire",
  BREVET: "Brevet de formation",
  RELEVE_NOTES: "Relevé de notes",
  ATTESTATION: "Attestation",
  ATTESTATION_PARTICIPATION: "Attestation de participation",
};

export function isManagedDocumentType(
  value: unknown,
): value is ManagedDocumentType {
  return (
    typeof value === "string" &&
    ISSUED_DOCUMENT_TYPES.includes(value as ManagedDocumentType)
  );
}

export function getDocumentTypeLabel(documentType: ManagedDocumentType): string {
  return DOCUMENT_TYPE_LABELS[documentType];
}
