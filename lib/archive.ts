export type ArchiveAuditFields = {
  archivedAt: Date;
  archivedById: string | null;
};

export function buildArchiveAudit(userId?: string | null): ArchiveAuditFields {
  return {
    archivedAt: new Date(),
    archivedById: userId ?? null,
  };
}

export function buildIsArchivedUpdate(userId?: string | null) {
  return {
    isArchived: true,
    ...buildArchiveAudit(userId),
  };
}

export type ActiveArchiveFilter = "active" | "archived" | "all";

export function matchesBooleanStatusFilter(
  value: boolean | null | undefined,
  filter: ActiveArchiveFilter,
  activeWhenTrue = true,
): boolean {
  if (filter === "all") return true;
  const isActive = value === activeWhenTrue || (activeWhenTrue && value == null);
  return filter === "active" ? isActive : !isActive;
}

export function matchesIsArchivedFilter(
  isArchived: boolean | null | undefined,
  filter: ActiveArchiveFilter,
): boolean {
  if (filter === "all") return true;
  const archived = Boolean(isArchived);
  return filter === "archived" ? archived : !archived;
}
