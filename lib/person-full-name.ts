export function formatPersonFullName(person?: {
  name?: string | null;
  postnom?: string | null;
  prenom?: string | null;
} | null): string {
  if (!person) return "";
  return [person.name, person.postnom, person.prenom]
    .filter((part) => typeof part === "string" && part.trim())
    .map((part) => part!.trim())
    .join(" ")
    .trim();
}

export function angolaDirectorTitle(sex?: string | null): string {
  const normalized = (sex ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/^(m|masc|male|masculin|masculino)\b/.test(normalized)) {
    return "Director";
  }
  return "Directora";
}

export function declarationBlankName(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "________";
}

export function memberHasOrgRole(
  memberRole: string | null | undefined,
  target: string,
): boolean {
  const wanted = target.trim().toLowerCase();
  return (memberRole ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .includes(wanted);
}

/** Nom officiel de l'établissement dans la Declaração (description de branche). */
export function angolaDeclarationSchoolLabel(
  schoolName?: string | null,
  schoolCode?: string | null,
): string {
  return schoolName?.trim() || schoolCode?.trim() || "________";
}
