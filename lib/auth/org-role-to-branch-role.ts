import { ORG_ROLE } from "@/lib/permissions";
import { BranchRole } from "@/prisma/generated/prisma/enums";

function splitRoles(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

/** Mappe le rôle d’organisation vers le rôle BranchMember d’accès à l’établissement. */
export function orgRoleToBranchRole(
  orgRole: string | null | undefined,
): BranchRole {
  const roles = splitRoles(orgRole);

  if (roles.some((role) => role === ORG_ROLE.STUDENT || role === "student")) {
    return BranchRole.STUDENT;
  }
  if (roles.some((role) => role === ORG_ROLE.PARENT || role === "parent")) {
    return BranchRole.PARENT;
  }
  if (roles.some((role) => role === ORG_ROLE.TEACHER || role === "teacher")) {
    return BranchRole.TEACHER;
  }
  if (roles.some((role) => role === ORG_ROLE.CAISSIER || role === "caissier")) {
    return BranchRole.CAISSIER;
  }
  if (
    roles.some(
      (role) =>
        role === ORG_ROLE.DIRECTEUR ||
        role === ORG_ROLE.PREFET ||
        role === "directeur" ||
        role === "prefet",
    )
  ) {
    return BranchRole.DIRECTOR;
  }

  return BranchRole.ADMIN;
}
