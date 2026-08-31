import {
  accessControlStatements,
  organizationRoleStatements,
} from "@/lib/permissions";

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

/** Toutes les ressources du catalogue : absente = [] (refus explicite). */
export function completePermissionMatrix(
  input: Record<string, string[]>,
): Record<string, string[]> {
  const catalog = accessControlStatements as Record<string, readonly string[]>;
  const out: Record<string, string[]> = {};
  for (const [resource, allowed] of Object.entries(catalog)) {
    const allowSet = new Set(allowed.map(String));
    out[resource] = [...new Set((input[resource] ?? []).map(String))].filter(
      (action) => allowSet.has(action),
    );
  }
  return out;
}

export function roleStatementsMapToRecord(
  map: Map<string, RoleStatements>,
): Record<string, Record<string, string[]>> {
  const out: Record<string, Record<string, string[]>> = {};
  for (const [slug, statements] of map) {
    const rec: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(statements)) {
      rec[key] = value ? [...value].map(String) : [];
    }
    out[slug] = rec;
  }
  return out;
}

export function seedStatementsForRole(slug: string): RoleStatements | null {
  const org = organizationRoleStatements[slug];
  if (org) return org as RoleStatements;
  return null;
}

/** Map session / DB → statements par slug. */
export function statementsMapFromSession(
  session: unknown,
): Map<string, RoleStatements> | null {
  const org = (session as { organization?: { rolePermissions?: unknown } } | null)
    ?.organization;
  const raw = org?.rolePermissions;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return new Map(
    Object.entries(raw as Record<string, RoleStatements>),
  );
}

export function getStatementsForRole(
  slug: string,
  roleStatements?: Map<string, RoleStatements> | null,
): RoleStatements | null {
  const fromDb = roleStatements?.get(slug);
  if (roleStatements) {
    // Matrice dynamique (DB / session) : jamais de fusion avec le seed statique.
    return fromDb ?? null;
  }
  return seedStatementsForRole(slug);
}
