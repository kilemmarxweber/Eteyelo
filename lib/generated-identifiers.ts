function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function generateSlug(value: string, fallback = "item") {
  const slug = stripAccents(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

export function generateCode(value: string, fallback = "CODE", maxLength = 16) {
  const words = stripAccents(value)
    .toUpperCase()
    .trim()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);

  const initials = words.map((word) => word[0]).join("");
  const compact = words.join("-");
  const code = (initials.length >= 2 ? initials : compact).slice(0, maxLength);

  return code || fallback;
}

function getIdentifierWords(value: string) {
  return stripAccents(value)
    .toUpperCase()
    .trim()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

export function generateCourseCode(value: string, fallback = "COU") {
  const compact = stripAccents(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");

  return compact.slice(0, 3) || fallback;
}

export function generateClassCode(value: string, fallback = "CLS") {
  const words = getIdentifierWords(value);
  const firstPart = words[0]?.[0] ? `${words[0][0]}E` : "";
  const middlePart = (words[1] ?? words[0] ?? "").slice(0, 3);
  const lastPart =
    words.length > 2 ? (words[words.length - 1]?.[0] ?? "") : "";
  const code = `${firstPart}-${middlePart}${lastPart}`;

  return code.replace(/-$/, "") || fallback;
}

export async function ensureUniqueIdentifier(params: {
  base: string;
  exists: (value: string) => Promise<boolean>;
  maxLength?: number;
  separator?: string;
}) {
  const maxLength = params.maxLength ?? 32;
  const separator = params.separator ?? "-";
  const base = params.base.slice(0, maxLength);

  if (!(await params.exists(base))) return base;

  for (let index = 2; index < 10_000; index += 1) {
    const suffix = `${separator}${index}`;
    const candidate = `${base.slice(0, maxLength - suffix.length)}${suffix}`;
    if (!(await params.exists(candidate))) return candidate;
  }

  throw new Error("Impossible de generer un identifiant unique.");
}
