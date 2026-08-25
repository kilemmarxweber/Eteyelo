/**
 * Better Auth looks up sign-in emails with `email.toLowerCase()` and an exact
 * PostgreSQL match. Mixed-case or padded rows then log "User not found"
 * even though the account exists.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEmailString(value: string) {
  return value.trim().toLowerCase();
}

function normalizeEmailFilter(email: unknown, insensitive: boolean): unknown {
  if (typeof email === "string") {
    const normalized = normalizeEmailString(email);
    if (!insensitive) return normalized;
    return { equals: normalized, mode: "insensitive" };
  }
  if (!isRecord(email)) return email;
  const next = { ...email };
  if (typeof next.equals === "string") {
    next.equals = normalizeEmailString(next.equals);
    if (insensitive) next.mode = "insensitive";
  }
  if (Array.isArray(next.in)) {
    next.in = next.in.map((value) =>
      typeof value === "string" ? normalizeEmailString(value) : value,
    );
  }
  return next;
}

export function applyUserEmailWhere(
  where: unknown,
  options: { insensitive: boolean },
): void {
  if (!isRecord(where)) return;
  if ("email" in where) {
    where.email = normalizeEmailFilter(where.email, options.insensitive);
  }
  for (const key of ["AND", "OR", "NOT"] as const) {
    const nested = where[key];
    if (Array.isArray(nested)) {
      for (const item of nested) applyUserEmailWhere(item, options);
    } else {
      applyUserEmailWhere(nested, options);
    }
  }
}

export function normalizeUserEmailData(data: unknown): void {
  if (!isRecord(data)) return;
  if (typeof data.email === "string") {
    data.email = normalizeEmailString(data.email);
  }
}
