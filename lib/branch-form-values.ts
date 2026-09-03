import type { CreateBranchFormValues } from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/schema";
import { isExtendedBranch } from "@/lib/branch-capabilities";
import { schoolCyclesForBranchForm } from "@/lib/cycle";
import {
  isEducationSystem,
  normalizeEducationSystem,
} from "@/lib/education-system";
import { branchTypeSchema } from "@/lib/schemas/extended-branch";

export const DEFAULT_BRANCH_LATITUDE = -4.4419;
export const DEFAULT_BRANCH_LONGITUDE = 15.2663;
export const DEFAULT_BRANCH_ATTENDANCE_RADIUS = 10;

type BranchImageItem = {
  logo: string;
  event: string[];
  gallery: string[];
  ecole: string[];
};

export function normalizeBranchImages(value: unknown): BranchImageItem {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const image = value as Partial<BranchImageItem>;
    return {
      logo: typeof image.logo === "string" ? image.logo : "",
      event: Array.isArray(image.event) ? image.event.filter(Boolean) : [],
      gallery: Array.isArray(image.gallery)
        ? image.gallery.filter(Boolean)
        : [],
      ecole: Array.isArray(image.ecole) ? image.ecole.filter(Boolean) : [],
    };
  }

  return {
    logo: "",
    event: [],
    gallery: [],
    ecole: [],
  };
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  if (value == null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export type BranchFormSource = {
  name: string;
  description?: string | null;
  code?: string | null;
  image?: unknown;
  adresse?: string | null;
  note?: string | null;
  province?: string | null;
  ville?: string | null;
  commune?: string | null;
  pays?: string | null;
  idnat?: string | null;
  tel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  attendanceRadius?: number | null;
  typebranch: unknown;
  educationSystem?: unknown;
  cycles?: Array<{ cycle: unknown; isActive?: boolean }> | null;
  classes?: Array<{ cycle?: unknown | null }> | null;
};

export function toBranchFormValues(branch: BranchFormSource): CreateBranchFormValues {
  const parsedType = branchTypeSchema.safeParse(branch.typebranch);
  const typebranch = parsedType.success ? parsedType.data : "SECONDAIRE";
  const schoolCycles = schoolCyclesForBranchForm({
    typebranch,
    branchCycles: branch.cycles,
    classCycles: (branch.classes ?? []).map((row) => row.cycle),
  });

  return {
    name: branch.name,
    description: branch.description ?? "",
    code: branch.code ?? "",
    image: normalizeBranchImages(branch.image),
    adresse: branch.adresse ?? "",
    note: branch.note ?? "",
    province: branch.province ?? "",
    ville: branch.ville ?? "",
    commune: branch.commune ?? "",
    pays: branch.pays?.trim() || "RDC",
    idnat: branch.idnat ?? "",
    tel: branch.tel ?? "",
    latitude: clampNumber(branch.latitude, DEFAULT_BRANCH_LATITUDE, -90, 90),
    longitude: clampNumber(
      branch.longitude,
      DEFAULT_BRANCH_LONGITUDE,
      -180,
      180,
    ),
    attendanceRadius: Math.round(
      clampNumber(
        branch.attendanceRadius,
        DEFAULT_BRANCH_ATTENDANCE_RADIUS,
        10,
        10000,
      ),
    ),
    typebranch,
    schoolCycles: isExtendedBranch(typebranch) ? [] : schoolCycles,
    educationSystem: isEducationSystem(branch.educationSystem)
      ? branch.educationSystem
      : normalizeEducationSystem(branch.educationSystem),
  };
}
