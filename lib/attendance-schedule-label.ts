export function formatScheduleHour(hour: Date) {
  return hour.toISOString().slice(11, 16);
}

export function formatExpectedSessionLabel(
  hour: Date,
  teaching?: {
    cours?: { nameCours: string | null } | null;
    classe?: { codeClasse: string | null; nameClasse: string | null } | null;
  } | null,
) {
  const time = formatScheduleHour(hour);
  const cours = teaching?.cours?.nameCours ?? "Cours";
  const classe =
    teaching?.classe?.codeClasse ?? teaching?.classe?.nameClasse ?? null;

  return classe ? `${time} • ${classe} • ${cours}` : `${time} • ${cours}`;
}
