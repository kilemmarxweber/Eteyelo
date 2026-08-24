/** Nom court (cartes, menus) vs nom officiel des documents. */
export function branchDocumentName(branch: {
  name?: string | null;
  description?: string | null;
}): string {
  const description = branch.description?.trim();
  if (description) return description;
  return (branch.name ?? "").trim();
}
