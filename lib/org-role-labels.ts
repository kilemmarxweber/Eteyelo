import { ALL_ORG_ROLE_SLUGS, ORG_ROLE, SCHOOL_HEAD_ORG_ROLES } from "@/lib/permissions";
import { normalizeBranchType } from "@/lib/academic-structure";

/** Libellés UI pour les slugs de rôle d’organisation. */
export const ORG_ROLE_LABEL: Record<
  (typeof ALL_ORG_ROLE_SLUGS)[number],
  string
> = {
  [ORG_ROLE.OWNER]: "Propriétaire",
  [ORG_ROLE.GESTIONNAIRE]: "Gestionnaire",
  [ORG_ROLE.PREFET]: "Préfet",
  [ORG_ROLE.DIRECTEUR]: "Directeur",
  [ORG_ROLE.DIRECTEUR_ETUDES]: "Directeur des études",
  [ORG_ROLE.TEACHER]: "Enseignant",
  [ORG_ROLE.SUPERVISEUR]: "Superviseur",
  [ORG_ROLE.CAISSIER]: "Caissier",
  [ORG_ROLE.STUDENT]: "Élève",
  [ORG_ROLE.PARENT]: "Parent",
  [ORG_ROLE.SUPPORT]: "Support établissement",
};

/**
 * Libellé chef d’établissement selon le type d’école :
 * primaire → Directeur ; secondaire / humanités → Préfet.
 */
export function schoolHeadRoleLabel(typebranch?: unknown): string {
  const type = normalizeBranchType(typebranch);
  if (type === "PRIMAIRE") return "Directeur";
  return "Préfet";
}

export function isSchoolHeadOrgRole(slug: string | null | undefined): boolean {
  const normalized = (slug ?? "").trim().toLowerCase();
  return (SCHOOL_HEAD_ORG_ROLES as readonly string[]).includes(normalized);
}

export function orgRoleLabel(
  slug: string,
  options?: { typebranch?: unknown },
): string {
  const normalized = slug.trim().toLowerCase();

  if (options?.typebranch != null && isSchoolHeadOrgRole(normalized)) {
    return schoolHeadRoleLabel(options.typebranch);
  }

  return ORG_ROLE_LABEL[normalized as keyof typeof ORG_ROLE_LABEL] ?? slug;
}
