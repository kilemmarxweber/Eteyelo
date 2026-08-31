/**
 * Correspondance BranchArea → permission DAC (P6).
 * Enforcement progressif : `canAccessBranchArea` peut consulter ce map
 * quand `PERMISSIONS_FROM_DAC=true` (sinon helpers session-roles).
 */

import type { OrganizationPermissionPayload } from "@/lib/auth/has-organization-permission";

/**
 * Zones sensibles sous `.../branches/[branchId]/` (unit-09).
 * Une zone = entrée menu / layout ; souvent `resource: ["read"]` (= Voir).
 */
export type BranchArea =
  | "finance"
  | "payroll"
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
  | "fiches"
  | "fiche_centrale"
  | "finalistes"
  | "courses"
  | "ponderations"
  | "vacation"
  | "sections"
  | "options"
  | "classe"
  | "attendance"
  | "fee_types"
  | "exchange_rates"
  | "public_communication"
  | "school_calendar"
  | "school_year"
  | "periods"
  | "structure_copy"
  | "roles_privileges";

/** Permission minimale pour ENTRER dans une zone (souvent `read`). */
export const BRANCH_AREA_PERMISSION: Record<
  BranchArea,
  OrganizationPermissionPayload
> = {
  finance: { finance: ["read", "encaisser"] },
  payroll: { payroll: ["read"] },
  /** Catalogue frais (ex-oversight) : `fees:read`. */
  fee_catalog: { fees: ["read"] },
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
  fiche_centrale: { ficheCentrale: ["read"] },
  finalistes: { finalistes: ["read"] },
  courses: { courses: ["read"] },
  ponderations: { ponderations: ["read"] },
  vacation: { vacation: ["read"] },
  sections: { sections: ["read"] },
  options: { options: ["read"] },
  classe: { classe: ["read"] },
  attendance: { attendance: ["read"] },
  fee_types: { feeTypes: ["read"] },
  exchange_rates: { exchangeRates: ["read"] },
  public_communication: { publicCommunication: ["read"] },
  school_calendar: { schoolCalendar: ["read"] },
  school_year: { schoolYear: ["read"] },
  periods: { periods: ["read"] },
  structure_copy: { structureCopy: ["read"] },
  roles_privileges: { ac: ["read"] },
};

/**
 * Hrefs logiques sidebar `/admin/...` → zone DAC (Voir = entrée menu).
 * Les sous-menus sans mapping restent filtrés par rôles legacy.
 */
export const SIDEBAR_HREF_BRANCH_AREA: Record<string, BranchArea> = {
  "/admin/registration": "registration",
  "/admin/attendance": "attendance",
  "/admin/cours": "courses",
  "/admin/coursPonderationOption": "ponderations",
  "/admin/teaching": "teaching",
  "/admin/creneau": "vacation",
  "/admin/schedule": "schedule",
  "/admin/section": "sections",
  "/admin/option": "options",
  "/admin/classe": "classe",
  "/admin/frais": "fee_catalog",
  "/admin/paiement": "finance",
  "/admin/paie-enseignants": "payroll",
  "/admin/transactions": "payroll",
  "/admin/results": "results",
  "/admin/devoirs": "devoirs",
  "/admin/bibliotheque": "library",
  "/admin/notes": "notes",
  "/admin/ficheCentrales": "fiche_centrale",
  "/admin/fiches": "fiches",
  "/admin/finalistes": "finalistes",
  "/admin/student": "students",
  "/admin/personnel": "hr_directory",
  "/admin/teacher": "pedagogy",
  "/admin/parent": "hr_directory",
};

/** Settings sous-menus → zone DAC. */
export const SETTINGS_HREF_BRANCH_AREA: Record<string, BranchArea> = {
  roles: "roles_privileges",
  typeFrais: "fee_types",
  "exchange-rates": "exchange_rates",
  whatsapp: "branch_org_settings",
  messagerie: "branch_org_settings",
  bibliotheque: "library",
  "inscription-publique": "public_communication",
  calendar: "school_calendar",
  "annee-scolaire": "school_year",
  periodes: "periods",
  attendance: "attendance",
  "structure-merge": "structure_copy",
  support: "support_settings",
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
