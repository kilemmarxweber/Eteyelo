export const EVENT_LOCALES = [
  { code: "fr", label: "Francais", short: "FR" },
  { code: "en", label: "Anglais", short: "EN" },
  { code: "pt", label: "Portugais", short: "PT" },
  { code: "ln", label: "Lingala", short: "LN" },
] as const;

export type EventLocaleCode = (typeof EVENT_LOCALES)[number]["code"];

export type EventLocaleMap = Partial<Record<EventLocaleCode, string>>;

export function emptyLocaleMap(): EventLocaleMap {
  return { fr: "", en: "", pt: "", ln: "" };
}

export function normalizeLocaleMap(value: unknown): EventLocaleMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyLocaleMap();
  }

  const source = value as Record<string, unknown>;
  return {
    fr: typeof source.fr === "string" ? source.fr : "",
    en: typeof source.en === "string" ? source.en : "",
    pt: typeof source.pt === "string" ? source.pt : "",
    ln: typeof source.ln === "string" ? source.ln : "",
  };
}

export function compactLocaleMap(map: EventLocaleMap): EventLocaleMap | null {
  const next: EventLocaleMap = {};
  for (const locale of EVENT_LOCALES) {
    const text = map[locale.code]?.trim();
    if (text) next[locale.code] = text;
  }
  return Object.keys(next).length ? next : null;
}
