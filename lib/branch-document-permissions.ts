import {
  canManageOrganization,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";
import {
  isAtelierBranch,
  isCentreFormationBranch,
  isUniversiteBranch,
  usesAttestationForBranch,
  usesBrevetForBranch,
  usesReleveForBranch,
} from "@/lib/branch-capabilities";

export type DocumentIssueAction =
  | "ISSUE_BREVET"
  | "ISSUE_RELEVE"
  | "ISSUE_ATTESTATION"
  | "ATTACH_PDF";

const DOCUMENT_ISSUER_ROLES = [
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.SUPERVISEUR,
  "ADMIN",
  "DIRECTOR",
  "director",
  "admin",
] as const;

export function canIssueBranchDocuments(
  session: unknown,
  branchMemberRole?: string | null,
): boolean {
  return hasSessionRole(session, [...DOCUMENT_ISSUER_ROLES], branchMemberRole);
}

export function canImportStudentsInBranch(
  session: unknown,
  branchMemberRole?: string | null,
): boolean {
  return canManageOrganization(session, branchMemberRole);
}

export function isDocumentIssueAllowedForBranch(
  typebranch: unknown,
  action: DocumentIssueAction,
): boolean {
  switch (action) {
    case "ISSUE_BREVET":
      return usesBrevetForBranch(typebranch);
    case "ISSUE_RELEVE":
      return usesReleveForBranch(typebranch);
    case "ISSUE_ATTESTATION":
      return usesAttestationForBranch(typebranch);
    case "ATTACH_PDF":
      return (
        usesBrevetForBranch(typebranch) ||
        usesReleveForBranch(typebranch) ||
        usesAttestationForBranch(typebranch)
      );
    default:
      return false;
  }
}

export function assertDocumentIssuePermission(params: {
  session: unknown;
  branchMemberRole?: string | null;
  typebranch: unknown;
  action: DocumentIssueAction;
}): { ok: true } | { ok: false; message: string } {
  if (!canIssueBranchDocuments(params.session, params.branchMemberRole)) {
    return {
      ok: false,
      message: "Vous n'avez pas la permission d'emettre des documents officiels",
    };
  }

  if (!isDocumentIssueAllowedForBranch(params.typebranch, params.action)) {
    return {
      ok: false,
      message: "Ce type de document n'est pas disponible pour cette branche",
    };
  }

  return { ok: true };
}

export function getAllowedDocumentActions(typebranch: unknown): DocumentIssueAction[] {
  const actions: DocumentIssueAction[] = [];

  if (usesBrevetForBranch(typebranch)) actions.push("ISSUE_BREVET");
  if (usesReleveForBranch(typebranch)) actions.push("ISSUE_RELEVE");
  if (usesAttestationForBranch(typebranch)) actions.push("ISSUE_ATTESTATION");
  if (actions.length > 0) actions.push("ATTACH_PDF");

  return actions;
}

export function describeBranchDocumentCapabilities(typebranch: unknown): string {
  if (isAtelierBranch(typebranch)) {
    return "Attestations de participation pour les eleves importes.";
  }
  if (isCentreFormationBranch(typebranch)) {
    return "Brevets de formation pour les apprenants inscrits a une session.";
  }
  if (isUniversiteBranch(typebranch)) {
    return "Releves de notes et attestations universitaires.";
  }
  return "Documents officiels non disponibles pour ce type de branche.";
}
