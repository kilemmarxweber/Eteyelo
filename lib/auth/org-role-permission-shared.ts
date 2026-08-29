import { organizationRoleStatements } from "@/lib/permissions";

export type RoleStatements = Record<string, readonly string[] | undefined>;

export function parseOrganizationRolePermission(
  raw: string | null | undefined,
): Record<string, string[]> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        out[key] = value.map(String);
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function seedStatementsForRole(slug: string): RoleStatements | null {
  const org = organizationRoleStatements[slug];
  if (org) return org as RoleStatements;
  return null;
}

export function getStatementsForRole(
  slug: string,
  roleStatements?: Map<string, RoleStatements> | null,
): RoleStatements | null {
  if (roleStatements?.has(slug)) {
    return roleStatements.get(slug) ?? null;
  }
  return seedStatementsForRole(slug);
}
