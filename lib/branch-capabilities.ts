import {
  type ManagedBranchType,
  isManagedBranchType,
  normalizeBranchType,
} from "@/lib/academic-structure";

export type StudentEnrollmentPolicy = "LINK_ONLY" | "CREATE_OR_LINK";

export type ClassDisplayLabel =
  | "Classe"
  | "Auditoire"
  | "Groupe"
  | "Session";

export type AcademicStructureKey =
  | "primary"
  | "secondary"
  | "university"
  | "training"
  | "workshop";

export type BranchCapability = {
  typebranch: ManagedBranchType;
  label: string;
  shortLabel: string;
  studentPolicy: StudentEnrollmentPolicy;
  usesSectionOption: boolean;
  classLabel: ClassDisplayLabel;
  classLabelPlural: string;
  usesBulletin: boolean;
  usesReleve: boolean;
  usesBrevet: boolean;
  usesAttestation: boolean;
  usesPonderation: boolean;
  usesFinance: boolean;
  academicStructureKey: AcademicStructureKey;
  isSchoolBranch: boolean;
};

const BRANCH_CAPABILITIES: Record<ManagedBranchType, BranchCapability> = {
  PRIMAIRE: {
    typebranch: "PRIMAIRE",
    label: "Primaire",
    shortLabel: "Primaire",
    studentPolicy: "CREATE_OR_LINK",
    usesSectionOption: false,
    classLabel: "Classe",
    classLabelPlural: "Classes",
    usesBulletin: true,
    usesReleve: false,
    usesBrevet: false,
    usesAttestation: false,
    usesPonderation: false,
    usesFinance: true,
    academicStructureKey: "primary",
    isSchoolBranch: true,
  },
  SECONDAIRE: {
    typebranch: "SECONDAIRE",
    label: "Secondaire",
    shortLabel: "Secondaire",
    studentPolicy: "CREATE_OR_LINK",
    usesSectionOption: true,
    classLabel: "Classe",
    classLabelPlural: "Classes",
    usesBulletin: true,
    usesReleve: false,
    usesBrevet: false,
    usesAttestation: false,
    usesPonderation: true,
    usesFinance: true,
    academicStructureKey: "secondary",
    isSchoolBranch: true,
  },
  ATELIER: {
    typebranch: "ATELIER",
    label: "Atelier",
    shortLabel: "Atelier",
    studentPolicy: "LINK_ONLY",
    usesSectionOption: false,
    classLabel: "Groupe",
    classLabelPlural: "Groupes",
    usesBulletin: false,
    usesReleve: false,
    usesBrevet: false,
    usesAttestation: true,
    usesPonderation: false,
    usesFinance: false,
    academicStructureKey: "workshop",
    isSchoolBranch: false,
  },
  CENTRE_FORMATION: {
    typebranch: "CENTRE_FORMATION",
    label: "Centre de formation",
    shortLabel: "Centre",
    studentPolicy: "CREATE_OR_LINK",
    usesSectionOption: true,
    classLabel: "Session",
    classLabelPlural: "Sessions",
    usesBulletin: false,
    usesReleve: false,
    usesBrevet: true,
    usesAttestation: false,
    usesPonderation: true,
    usesFinance: true,
    academicStructureKey: "training",
    isSchoolBranch: false,
  },
  UNIVERSITE: {
    typebranch: "UNIVERSITE",
    label: "Université",
    shortLabel: "Université",
    studentPolicy: "CREATE_OR_LINK",
    usesSectionOption: true,
    classLabel: "Auditoire",
    classLabelPlural: "Auditoires",
    usesBulletin: false,
    usesReleve: true,
    usesBrevet: false,
    usesAttestation: true,
    usesPonderation: true,
    usesFinance: true,
    academicStructureKey: "university",
    isSchoolBranch: false,
  },
};

export const EXTENDED_BRANCH_TYPES = [
  "ATELIER",
  "CENTRE_FORMATION",
  "UNIVERSITE",
] as const satisfies readonly ManagedBranchType[];

export type ExtendedBranchType = (typeof EXTENDED_BRANCH_TYPES)[number];

export const SCHOOL_BRANCH_TYPES = ["PRIMAIRE", "SECONDAIRE"] as const satisfies readonly ManagedBranchType[];

export type SchoolBranchType = (typeof SCHOOL_BRANCH_TYPES)[number];

export function getBranchCapabilities(typebranch: unknown): BranchCapability {
  const normalized = normalizeBranchType(typebranch);
  return BRANCH_CAPABILITIES[normalized];
}

export function getBranchTypeLabel(typebranch: unknown): string {
  return getBranchCapabilities(typebranch).label;
}

export function getBranchTypeShortLabel(typebranch: unknown): string {
  return getBranchCapabilities(typebranch).shortLabel;
}

export function canCreateStudentInBranch(typebranch: unknown): boolean {
  return getBranchCapabilities(typebranch).studentPolicy === "CREATE_OR_LINK";
}

export function requiresStudentImport(typebranch: unknown): boolean {
  return getBranchCapabilities(typebranch).studentPolicy === "LINK_ONLY";
}

export function getClassDisplayLabel(typebranch: unknown): ClassDisplayLabel {
  return getBranchCapabilities(typebranch).classLabel;
}

export function getClassDisplayLabelPlural(typebranch: unknown): string {
  return getBranchCapabilities(typebranch).classLabelPlural;
}

export function usesSectionOptionForBranch(typebranch: unknown): boolean {
  return getBranchCapabilities(typebranch).usesSectionOption;
}

export function usesBulletinForBranch(typebranch: unknown): boolean {
  return getBranchCapabilities(typebranch).usesBulletin;
}

export function usesReleveForBranch(typebranch: unknown): boolean {
  return getBranchCapabilities(typebranch).usesReleve;
}

export function usesBrevetForBranch(typebranch: unknown): boolean {
  return getBranchCapabilities(typebranch).usesBrevet;
}

export function usesAttestationForBranch(typebranch: unknown): boolean {
  return getBranchCapabilities(typebranch).usesAttestation;
}

export function usesPonderationForBranch(typebranch: unknown): boolean {
  return getBranchCapabilities(typebranch).usesPonderation;
}

export function usesFinanceForBranch(typebranch: unknown): boolean {
  return getBranchCapabilities(typebranch).usesFinance;
}

export function isSchoolBranch(typebranch: unknown): boolean {
  return getBranchCapabilities(typebranch).isSchoolBranch;
}

export function isExtendedBranch(typebranch: unknown): boolean {
  const normalized = normalizeBranchType(typebranch);
  return (EXTENDED_BRANCH_TYPES as readonly string[]).includes(normalized);
}

export function isAtelierBranch(typebranch: unknown): boolean {
  return normalizeBranchType(typebranch) === "ATELIER";
}

export function isCentreFormationBranch(typebranch: unknown): boolean {
  return normalizeBranchType(typebranch) === "CENTRE_FORMATION";
}

export function isUniversiteBranch(typebranch: unknown): boolean {
  return normalizeBranchType(typebranch) === "UNIVERSITE";
}

/** Calendrier LMD, releves, auditoires, libelles ESU — reserve a UNIVERSITE. */
export function usesUniversityLmdFeatures(typebranch: unknown): boolean {
  return isUniversiteBranch(typebranch);
}

export function hidesParentManagement(typebranch: unknown): boolean {
  return isAtelierBranch(typebranch) || isUniversiteBranch(typebranch);
}

export function isPrimaryBranch(typebranch: unknown): boolean {
  return normalizeBranchType(typebranch) === "PRIMAIRE";
}

export function isSecondaryBranch(typebranch: unknown): boolean {
  return normalizeBranchType(typebranch) === "SECONDAIRE";
}

export function assertSchoolBranchFeatures(typebranch: unknown) {
  if (!isSchoolBranch(typebranch)) {
    throw new Error(
      "Cette fonctionnalite n'est disponible que pour les branches scolaires (primaire/secondaire)",
    );
  }
}

export function assertSectionOptionBranchFeatures(typebranch: unknown) {
  if (!usesSectionOptionForBranch(typebranch)) {
    throw new Error(
      "Cette fonctionnalite n'est pas disponible pour ce type de branche",
    );
  }
}

export function assertExtendedBranchFeatures(typebranch: unknown) {
  if (!isExtendedBranch(typebranch)) {
    throw new Error(
      "Cette fonctionnalite n'est disponible que pour atelier, centre de formation ou universite",
    );
  }
}

export function listBranchTypesForCreation(): ManagedBranchType[] {
  return Object.keys(BRANCH_CAPABILITIES) as ManagedBranchType[];
}

export const PUBLIC_REGISTRATION_BRANCH_TYPES = listBranchTypesForCreation().filter(
  (type) => type !== "ATELIER",
);

export function listBranchTypesForPublicRegistration(): ManagedBranchType[] {
  return PUBLIC_REGISTRATION_BRANCH_TYPES;
}

export function isBranchTypePubliclyRegistrable(
  value: unknown,
): value is ManagedBranchType {
  return isManagedBranchType(value) && value !== "ATELIER";
}

export function isBranchTypeCreatable(value: unknown): value is ManagedBranchType {
  return isManagedBranchType(value);
}
