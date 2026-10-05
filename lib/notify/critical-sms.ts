/**
 * P3 SMS bridge — avis critiques école (absence / tone rose).
 * Réutilise MessagingClient (même chemin que OTP SMS), sans USSD.
 */

import { MessagingClient } from "@/lib/messaging-client";
import { maskPhone, normalizePhoneE164 } from "@/lib/mobile/phone";

export type CriticalSmsLang = "fr" | "en" | "pt";

export type CriticalSmsResult =
  | { sent: true; channel: "sms" }
  | { sent: false; reason: string };

const CONFIRM_HINT: Record<CriticalSmsLang, string> = {
  fr: "Repondez OK ou 1 pour confirmer.",
  en: "Reply OK or 1 to confirm.",
  pt: "Responda OK ou 1 para confirmar.",
};

const PREFIX: Record<CriticalSmsLang, string> = {
  fr: "Avis ecole",
  en: "School notice",
  pt: "Aviso escolar",
};

function resolveLang(lang?: string | null): CriticalSmsLang {
  const raw = lang?.trim().toLowerCase();
  if (raw === "en" || raw === "pt" || raw === "fr") return raw;
  return "fr";
}

/** Texte SMS court (≤160 idéalement) demandant confirmation OK/1. */
export function formatCriticalNoticeSms(params: {
  title: string;
  intro?: string | null;
  lang?: CriticalSmsLang | string | null;
}): string {
  const lang = resolveLang(params.lang);
  const title = params.title.trim().slice(0, 80) || PREFIX[lang];
  const intro = params.intro?.trim().slice(0, 60);
  const hint = CONFIRM_HINT[lang];

  let text = `${PREFIX[lang]}: ${title}`;
  if (intro) text += ` — ${intro}`;
  text += `. ${hint}`;

  if (text.length > 320) {
    text = `${PREFIX[lang]}: ${title.slice(0, 100)}. ${hint}`;
  }
  return text;
}

function getMessagingSmsClient(): MessagingClient | null {
  const apiKey = process.env.MESSAGING_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl =
    process.env.MESSAGING_API_BASE_URL?.trim() ||
    "https://whatsapp-api.klambocore.com";
  return new MessagingClient({ apiKey, baseUrl });
}

/**
 * Envoie un SMS critique via l’API messaging (canal sms),
 * ou log + { sent: false } si non configuré.
 */
export async function enqueueOrSendCriticalNoticeSms(params: {
  organizationId: string;
  userId: string;
  telephone: string;
  title: string;
  intro?: string | null;
  lang?: CriticalSmsLang | string | null;
}): Promise<CriticalSmsResult> {
  const phone =
    normalizePhoneE164(params.telephone) ?? params.telephone.trim();
  if (!phone) {
    return { sent: false, reason: "invalid_phone" };
  }

  const text = formatCriticalNoticeSms({
    title: params.title,
    intro: params.intro,
    lang: params.lang,
  });

  const client = getMessagingSmsClient();
  if (!client) {
    console.info(
      `[critical-sms] skip (no MESSAGING_API_KEY) org=${params.organizationId} user=${params.userId} to=${maskPhone(phone)} text=${text.slice(0, 80)}…`,
    );
    return { sent: false, reason: "messaging_not_configured" };
  }

  try {
    await client.send({
      to: phone,
      channel: "sms",
      type: "text",
      text,
      queue_kind: "absence",
    });
    console.info(
      `[critical-sms] sent org=${params.organizationId} user=${params.userId} to=${maskPhone(phone)}`,
    );
    return { sent: true, channel: "sms" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(
      `[critical-sms] send failed org=${params.organizationId} to=${maskPhone(phone)}: ${detail}`,
    );
    return { sent: false, reason: detail.slice(0, 200) };
  }
}

/** Réponse parent « OK / 1 / oui / yes / sim ». */
export function isCriticalSmsAckText(text: string): boolean {
  return /^(ok|1|oui|yes|sim)\b/i.test(text.trim());
}
