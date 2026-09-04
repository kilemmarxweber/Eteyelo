import { PERSONNEL_ORG_ROLE_OPTIONS } from "@/lib/dual-staff-profile-shared";
import { splitSessionRoles } from "@/lib/auth/session-roles";

export type PersonnelScale = {
  role: string;
  gross: number;
  prime: number;
};

export function defaultPersonnelScales(): PersonnelScale[] {
  return PERSONNEL_ORG_ROLE_OPTIONS.map((role) => ({
    role,
    gross: 0,
    prime: 0,
  }));
}

export function parsePersonnelScales(value: unknown): PersonnelScale[] {
  const defaults = defaultPersonnelScales();
  if (!Array.isArray(value)) return defaults;
  const byRole = new Map<string, PersonnelScale>();
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const item = row as { role?: unknown; gross?: unknown; prime?: unknown };
    if (typeof item.role !== "string" || !item.role) continue;
    byRole.set(item.role, {
      role: item.role,
      gross: Math.max(0, Number(item.gross) || 0),
      prime: Math.max(0, Number(item.prime) || 0),
    });
  }
  return defaults.map((row) => byRole.get(row.role) ?? row);
}

export function personnelScaleForRole(
  orgRole: string | null | undefined,
  scales: PersonnelScale[],
): PersonnelScale {
  const roles = splitSessionRoles(orgRole);
  const allowed = new Set(PERSONNEL_ORG_ROLE_OPTIONS as readonly string[]);
  const slug =
    roles.find((role) => allowed.has(role)) ??
    roles[0] ??
    PERSONNEL_ORG_ROLE_OPTIONS[0];
  return (
    scales.find((row) => row.role === slug) ?? {
      role: slug,
      gross: 0,
      prime: 0,
    }
  );
}

export function resolvePersonnelPay(input: {
  ficheForfait: number | null | undefined;
  orgRole: string | null | undefined;
  scales: unknown;
}) {
  const scale = personnelScaleForRole(input.orgRole, parsePersonnelScales(input.scales));
  const fiche = Number(input.ficheForfait ?? 0);
  const gross = fiche > 0 ? fiche : scale.gross;
  return {
    role: scale.role,
    gross,
    prime: scale.prime,
    total: gross + scale.prime,
  };
}
