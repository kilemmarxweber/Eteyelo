/**
 * Carte notification messagerie (inbox Klambo) — même hiérarchie que l’email :
 * en-tête, intro, lignes d’infos, secret (mot de passe) / highlight (montant), note, CTA.
 * Stockée en `__NOTIFY__:{json}` dans le body (rendu web).
 * Mobile / WhatsApp : formatNotifyCardPlainText.
 */

export const NOTIFY_MESSAGE_PREFIX = "__NOTIFY__:";

export type NotifyCardRowKind =
  | "text"
  | "secret"
  | "highlight"
  | "link"
  | "email"
  | "phone";

export type NotifyCardRow = {
  label: string;
  value: string;
  kind?: NotifyCardRowKind;
};

export type NotifyMessageCard = {
  v: 1;
  /** navy | amber (secrets) | emerald (paiement/finance) | rose (absence) */
  tone?: "navy" | "amber" | "emerald" | "rose";
  title: string;
  intro?: string;
  rows?: NotifyCardRow[];
  note?: string;
  cta?: { label: string; href: string };
  brand?: string;
};

export type NotifyCardInput = {
  tone?: NotifyMessageCard["tone"];
  brand?: string | null;
  title: string;
  intro?: string | null;
  rows?: Array<{
    label: string;
    value: string;
    kind?: NotifyCardRowKind;
  } | null>;
  note?: string | null;
  cta?: { label: string; href: string } | null;
  /** Si true, retire la ligne dont la valeur = brand (ex. école déjà en en-tête). */
  omitBrandRow?: boolean;
};

export function isNotifyMessageBody(body: string): boolean {
  return body.trimStart().startsWith(NOTIFY_MESSAGE_PREFIX);
}

function normalizeKind(kind: unknown): NotifyCardRowKind | undefined {
  if (
    kind === "secret" ||
    kind === "highlight" ||
    kind === "link" ||
    kind === "email" ||
    kind === "phone"
  ) {
    return kind;
  }
  return undefined;
}

/** Construit une carte propre (sans lignes vides / doublon brand). */
export function buildNotifyCard(input: NotifyCardInput): NotifyMessageCard {
  const brand = input.brand?.trim() || undefined;
  const brandNorm = brand?.toLowerCase();
  const rows = (input.rows ?? [])
    .filter((r): r is NonNullable<typeof r> => Boolean(r?.label?.trim() && r?.value?.trim()))
    .filter((r) => {
      if (!input.omitBrandRow || !brandNorm) return true;
      return r.value.trim().toLowerCase() !== brandNorm;
    })
    .slice(0, 12)
    .map((r) => ({
      label: r.label.trim().slice(0, 80),
      value: r.value.trim().slice(0, 400),
      ...(r.kind && r.kind !== "text" ? { kind: r.kind } : {}),
    }));

  return {
    v: 1,
    tone: input.tone ?? "navy",
    title: input.title.trim().slice(0, 120),
    ...(input.intro?.trim()
      ? { intro: input.intro.trim().slice(0, 500) }
      : {}),
    ...(rows.length ? { rows } : {}),
    ...(input.note?.trim() ? { note: input.note.trim().slice(0, 400) } : {}),
    ...(input.cta?.href?.trim() && input.cta.label?.trim()
      ? {
          cta: {
            label: input.cta.label.trim().slice(0, 80),
            href: input.cta.href.trim().slice(0, 500),
          },
        }
      : {}),
    ...(brand ? { brand: brand.slice(0, 80) } : {}),
  };
}

export function serializeNotifyCard(card: NotifyMessageCard): string {
  return `${NOTIFY_MESSAGE_PREFIX}${JSON.stringify(buildNotifyCard(card))}`;
}

export function parseNotifyCard(body: string): NotifyMessageCard | null {
  const raw = body.trimStart();
  if (!raw.startsWith(NOTIFY_MESSAGE_PREFIX)) return null;
  try {
    const data = JSON.parse(
      raw.slice(NOTIFY_MESSAGE_PREFIX.length),
    ) as NotifyMessageCard;
    if (!data || typeof data !== "object" || !data.title?.trim()) return null;
    return buildNotifyCard({
      tone: data.tone,
      brand: data.brand,
      title: String(data.title),
      intro: data.intro ? String(data.intro) : undefined,
      rows: Array.isArray(data.rows)
        ? data.rows.map((r) => ({
            label: String(r?.label ?? ""),
            value: String(r?.value ?? ""),
            kind: normalizeKind(r?.kind),
          }))
        : [],
      note: data.note ? String(data.note) : undefined,
      cta: data.cta?.href && data.cta.label
        ? { label: String(data.cta.label), href: String(data.cta.href) }
        : undefined,
    });
  } catch {
    return null;
  }
}

/** Aperçu liste / inbox (texte plat court). */
export function formatNotifyCardPreview(body: string, max = 80): string {
  const card = parseNotifyCard(body);
  if (!card) return body;
  const highlight = card.rows?.find(
    (r) => r.kind === "secret" || r.kind === "highlight",
  );
  const text = highlight
    ? `${card.title} · ${highlight.label}`
    : card.title;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/**
 * Corps lisible (mobile / WhatsApp / fallback) — jamais le JSON brut.
 */
export function formatNotifyCardPlainText(
  bodyOrCard: string | NotifyMessageCard,
): string {
  const card =
    typeof bodyOrCard === "string"
      ? parseNotifyCard(bodyOrCard)
      : bodyOrCard;
  if (!card) {
    return typeof bodyOrCard === "string" ? bodyOrCard : "";
  }

  const lines: string[] = [];
  if (card.brand) lines.push(card.brand);
  lines.push(card.title);
  if (card.intro?.trim()) {
    lines.push("");
    lines.push(card.intro.trim());
  }
  if (card.rows?.length) {
    lines.push("");
    for (const row of card.rows) {
      lines.push(`${row.label} : ${row.value}`);
    }
  }
  if (card.note?.trim()) {
    lines.push("");
    lines.push(card.note.trim());
  }
  if (card.cta?.href?.trim()) {
    lines.push("");
    lines.push(`${card.cta.label} : ${card.cta.href.trim()}`);
  }
  return lines.join("\n").trim().slice(0, 4000);
}

/** Pour API mobile : JSON → texte ; sinon inchangé. */
export function toPlainClientMessageBody(body: string): string {
  if (!isNotifyMessageBody(body)) return body;
  return formatNotifyCardPlainText(body);
}

/** Parties texte pour gateway WhatsApp. */
export function notifyCardToWhatsAppParts(
  card: NotifyMessageCard,
): string[] {
  return formatNotifyCardPlainText(card)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Sérialise + parties WhatsApp en un coup. */
export function prepareNotifyDelivery(input: NotifyCardInput): {
  card: NotifyMessageCard;
  richBody: string;
  parts: string[];
} {
  const card = buildNotifyCard({ ...input, omitBrandRow: input.omitBrandRow ?? true });
  return {
    card,
    richBody: serializeNotifyCard(card),
    parts: notifyCardToWhatsAppParts(card),
  };
}
