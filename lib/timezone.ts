const TIMEZONE = "Europe/Paris";

function getZonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  return {
    hour: Number(parts.find((p) => p.type === "hour")?.value),
    minute: Number(parts.find((p) => p.type === "minute")?.value),
  };
}

export function toMinutes(date: Date) {
  const { hour, minute } = getZonedParts(date);
  return hour * 60 + minute;
}

export function nowLocal() {
  const now = new Date();
  const { hour, minute } = getZonedParts(now);

  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  return d;
}
