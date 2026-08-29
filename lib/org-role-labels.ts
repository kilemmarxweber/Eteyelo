import { normalizeBranchType } from "@/lib/academic-structure";
import { ALL_ORG_ROLE_SLUGS, ORG_ROLE, SCHOOL_HEAD_ORG_ROLES } from "@/lib/permissions";
import { getPeopleLabels } from "@/lib/people-labels";

/** Libellés UI pour les slugs de rôle d’organisation. */
export const ORG_ROLE_LABEL: Record<
  (typeof ALL_ORG_ROLE_SLUGS)[number],
  string
> = {
  [ORG_ROLE.OWNER]: "Propriétaire",
  [ORG_ROLE.GESTIONNAIRE]: "Gestionnaire",
  [ORG_ROLE.AGENT_BUREAU]: "Agent de bureau",
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
 * Libellé chef d’établissement selon le type de branche :
 * secondaire → Préfet ; primaire / centre / atelier / université → Directeur.
 */
export function schoolHeadRoleLabel(typebranch?: unknown): string {
  const type = normalizeBranchType(typebranch);
  if (type === "SECONDAIRE") return "Préfet";
  return "Directeur";
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

  if (options?.typebranch != null && normalized === ORG_ROLE.STUDENT) {
    return getPeopleLabels(options.typebranch).student;
  }

  if (options?.typebranch != null && normalized === ORG_ROLE.TEACHER) {
    return getPeopleLabels(options.typebranch).teacher;
  }

  return ORG_ROLE_LABEL[normalized as keyof typeof ORG_ROLE_LABEL] ?? slug;
}
