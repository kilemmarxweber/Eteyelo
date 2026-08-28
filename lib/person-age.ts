/** Âge en années révolues à partir d'une date de naissance. */
export function calculateAge(
  dateOfBirth: Date | string | null | undefined,
): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const birthdayNotReached =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() < birth.getDate());
  if (birthdayNotReached) age -= 1;
  return age >= 0 ? age : null;
}

export function formatAgeLabel(
  dateOfBirth: Date | string | null | undefined,
): string {
  const age = calculateAge(dateOfBirth);
  return age != null ? `${age} ans` : "—";
}

export function formatBirthDate(
  date: Date | string | null | undefined,
): string {
  if (!date) return "—";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "—";
  return value.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
