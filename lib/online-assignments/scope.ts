/**
 * Scope obligatoire des devoirs en ligne : toujours rattachés à une branche.
 * Aucune liste / détail sans branchId explicite.
 */
export function assertAssignmentBranchId(
  branchId: string | null | undefined,
): string {
  const id = typeof branchId === "string" ? branchId.trim() : "";
  if (!id) {
    throw new Error(
      "branchId obligatoire : un devoir ne peut pas exister hors branche.",
    );
  }
  return id;
}

/** Filtre Prisma : jamais de devoir sans branche / hors branche active. */
export function assignmentBranchWhere(branchId: string | null | undefined) {
  const id = assertAssignmentBranchId(branchId);
  return {
    branchId: id,
  } as const;
}
