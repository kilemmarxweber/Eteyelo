/**
 * Carte notification messagerie (inbox Klambo) — même hiérarchie que l’email :
 * en-tête, intro, lignes d’infos, secret (mot de passe) mis en avant, note, CTA.
 * Stockée en `__NOTIFY__:{json}` dans le body du message (rendu web).
 * Sur mobile / WhatsApp : utiliser formatNotifyCardPlainText.
 */

export const NOTIFY_MESSAGE_PREFIX = "__NOTIFY__:";

export type NotifyCardRowKind = "text" | "secret" | "link" | "email" | "phone";

export type NotifyCardRow = {
  label: string;
  value: string;
  kind?: NotifyCardRowKind;
};

export type NotifyMessageCard = {
  v: 1;
  /** Accent couleur : navy (défaut) | amber (secrets) | emerald (paiement) | rose (absence) */
  tone?: "navy" | "amber" | "emerald" | "rose";
  title: string;
  intro?: string;
  rows?: NotifyCardRow[];
  note?: string;
  cta?: { label: string; href: string };
  brand?: string;
};

export function isNotifyMessageBody(body: string): boolean {
  return body.trimStart().startsWith(NOTIFY_MESSAGE_PREFIX);
}

export function serializeNotifyCard(card: NotifyMessageCard): string {
  const payload: NotifyMessageCard = {
    v: 1,
    tone: card.tone ?? "navy",
    title: card.title.trim().slice(0, 120),
    ...(card.intro?.trim()
      ? { intro: card.intro.trim().slice(0, 500) }
      : {}),
    ...(card.rows?.length
      ? {
          rows: card.rows
            .filter((r) => r.label.trim() && r.value.trim())
            .slice(0, 12)
            .map((r) => ({
              label: r.label.trim().slice(0, 80),
              value: r.value.trim().slice(0, 400),
              ...(r.kind && r.kind !== "text" ? { kind: r.kind } : {}),
            })),
        }
      : {}),
    ...(card.note?.trim() ? { note: card.note.trim().slice(0, 400) } : {}),
    ...(card.cta?.href?.trim() && card.cta.label?.trim()
      ? {
          cta: {
            label: card.cta.label.trim().slice(0, 80),
            href: card.cta.href.trim().slice(0, 500),
          },
        }
      : {}),
    ...(card.brand?.trim()
      ? { brand: card.brand.trim().slice(0, 80) }
      : {}),
  };
  return `${NOTIFY_MESSAGE_PREFIX}${JSON.stringify(payload)}`;
}

export function parseNotifyCard(body: string): NotifyMessageCard | null {
  const raw = body.trimStart();
  if (!raw.startsWith(NOTIFY_MESSAGE_PREFIX)) return null;
  try {
    const data = JSON.parse(
      raw.slice(NOTIFY_MESSAGE_PREFIX.length),
    ) as NotifyMessageCard;
    if (!data || typeof data !== "object" || !data.title?.trim()) return null;
    return {
      v: 1,
      tone: data.tone ?? "navy",
      title: String(data.title).slice(0, 120),
      intro: data.intro ? String(data.intro).slice(0, 500) : undefined,
      rows: Array.isArray(data.rows)
        ? data.rows
            .filter(
              (r) =>
                r &&
                typeof r.label === "string" &&
                typeof r.value === "string",
            )
            .slice(0, 12)
            .map((r) => ({
              label: String(r.label).slice(0, 80),
              value: String(r.value).slice(0, 400),
              kind: normalizeKind(r.kind),
            }))
        : undefined,
      note: data.note ? String(data.note).slice(0, 400) : undefined,
      cta:
        data.cta?.href && data.cta.label
          ? {
              label: String(data.cta.label).slice(0, 80),
              href: String(data.cta.href).slice(0, 500),
            }
          : undefined,
      brand: data.brand ? String(data.brand).slice(0, 80) : undefined,
    };
  } catch {
    return null;
  }
}

function normalizeKind(kind: unknown): NotifyCardRowKind | undefined {
  if (
    kind === "secret" ||
    kind === "link" ||
    kind === "email" ||
    kind === "phone"
  ) {
    return kind;
  }
  return undefined;
}

/** Aperçu liste / inbox (texte plat court). */
export function formatNotifyCardPreview(body: string, max = 80): string {
  const card = parseNotifyCard(body);
  if (!card) return body;
  const text = card.title;
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

/** Texte plat pour gateway WhatsApp (parties). */
export function notifyCardToWhatsAppParts(
  card: NotifyMessageCard,
): string[] {
  return formatNotifyCardPlainText(card)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
