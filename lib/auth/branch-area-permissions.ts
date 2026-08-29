/**
 * Correspondance BranchArea → permission DAC (P6).
 * Enforcement progressif : `canAccessBranchArea` peut consulter ce map
 * quand `PERMISSIONS_FROM_DAC=true` (sinon helpers session-roles).
 */

import type { OrganizationPermissionPayload } from "@/lib/auth/has-organization-permission";

/**
 * Zones sensibles sous `.../branches/[branchId]/` (unit-09).
 */
export type BranchArea =
  | "finance"
  | "fee_catalog"
  | "notes"
  | "schedule"
  | "teaching"
  | "pedagogy"
  | "results"
  | "devoirs"
  | "library"
  | "school_admin"
  | "registration"
  | "students"
  | "hr_directory"
  | "hr_write"
  | "branch_org_settings"
  | "school_ops_settings"
  | "support_settings"
  | "fiches";

/** Permission minimale pour ENTRER dans une zone (souvent `read`). */
export const BRANCH_AREA_PERMISSION: Record<
  BranchArea,
  OrganizationPermissionPayload
> = {
  finance: { finance: ["read", "encaisser"] },
  /** Oversight frais : finance + admin org léger (exclut caissier). */
  fee_catalog: { finance: ["read"], organization: ["update"] },
  notes: { notes: ["read"] },
  schedule: { schedule: ["read"] },
  teaching: { teaching: ["read"] },
  pedagogy: { student: ["read"] },
  results: { results: ["read"] },
  devoirs: { devoirs: ["read"] },
  library: { library: ["read"] },
  school_admin: { student: ["read"] },
  registration: { inscription: ["read"] },
  students: { student: ["read"] },
  hr_directory: { personnel: ["read"] },
  hr_write: { personnel: ["update"] },
  branch_org_settings: { settings: ["read"] },
  school_ops_settings: { settings: ["read"] },
  support_settings: { organizationSupport: ["read"] },
  fiches: { fiches: ["read"] },
};

export function isPermissionsFromDacEnabled(): boolean {
  const raw = process.env.PERMISSIONS_FROM_DAC?.trim().toLowerCase();
  // Désactiver explicitement : false / 0. Sinon activé pour que la matrice
  // Rôles & privilèges (OrganizationRole) pilote les accès zone.
  if (raw === "false" || raw === "0" || raw === "off" || raw === "no") {
    return false;
  }
  return true;
}
