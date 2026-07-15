import { ALL_ORG_ROLE_SLUGS, ORG_ROLE } from "@/lib/permissions";

/** Libellés UI pour les slugs de rôle d’organisation. */
export const ORG_ROLE_LABEL: Record<
  (typeof ALL_ORG_ROLE_SLUGS)[number],
  string
> = {
  [ORG_ROLE.OWNER]: "Propriétaire",
  [ORG_ROLE.GESTIONNAIRE]: "Gestionnaire",
  [ORG_ROLE.PREFET]: "Préfet",
  [ORG_ROLE.DIRECTEUR]: "Directeur",
  [ORG_ROLE.TEACHER]: "Enseignant",
  [ORG_ROLE.SUPERVISEUR]: "Superviseur",
  [ORG_ROLE.CAISSIER]: "Caissier",
  [ORG_ROLE.STUDENT]: "Eleve",
  [ORG_ROLE.PARENT]: "Parent",
  [ORG_ROLE.SUPPORT]: "Support établissement",
};

export function orgRoleLabel(slug: string): string {
  return ORG_ROLE_LABEL[slug as keyof typeof ORG_ROLE_LABEL] ?? slug;
}
