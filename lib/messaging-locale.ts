import "server-only";

import { createTranslator, type AbstractIntlMessages } from "next-intl";
import { cache } from "react";

import { bulletinLocaleForEducationSystem } from "@/lib/education-system";
import { prisma } from "@/lib/prisma";
import {
  intlLocaleFromUserLocale,
  normalizeUserLocale,
  type UserLocale,
} from "@/lib/user-locale";

export type MessagingLocale = UserLocale;

export type MessagingTranslateValues = Record<
  string,
  string | number | Date | boolean | null | undefined
>;

export type MessagingTranslator = (
  key: string,
  values?: MessagingTranslateValues,
) => string;

function isAngolaCountry(pays: unknown): boolean {
  if (typeof pays !== "string") return false;
  const n = pays
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
  return (
    n === "ao" ||
    n === "angola" ||
    n.includes("angola") ||
    n === "republica de angola" ||
    n === "republique d angola"
  );
}

/**
 * Locale des emails / WhatsApp selon le système éducatif de la branche.
 * ANGOLAIS (ou pays Angola) → pt · ANGLAIS → en · sinon fr.
 */
export function resolveBranchMessagingLocale(input: {
  educationSystem?: unknown;
  pays?: unknown;
}): MessagingLocale {
  if (isAngolaCountry(input.pays)) return "pt";
  return bulletinLocaleForEducationSystem(input.educationSystem);
}

/** Auth / compte : branche si connue, sinon préférence utilisateur, sinon fr. */
export function resolveMessagingLocaleForUser(input: {
  branch?: { educationSystem?: unknown; pays?: unknown } | null;
  userLocale?: unknown;
}): MessagingLocale {
  if (input.branch) {
    return resolveBranchMessagingLocale(input.branch);
  }
  return normalizeUserLocale(input.userLocale);
}

const loadNotificationsMessages = cache(async (locale: MessagingLocale) => {
  const safe = normalizeUserLocale(locale);
  const mod = await import(`../messages/${safe}/notifications.json`);
  return mod.default as Record<string, unknown>;
});

export async function getMessagingTranslator(
  locale: MessagingLocale = "fr",
): Promise<MessagingTranslator> {
  const safe = normalizeUserLocale(locale);
  const notifications = await loadNotificationsMessages(safe);
  const t = createTranslator({
    locale: intlLocaleFromUserLocale(safe),
    messages: { notifications } as AbstractIntlMessages,
    namespace: "notifications",
  });
  return ((key: string, values?: MessagingTranslateValues) =>
    t(key as never, values as never)) as MessagingTranslator;
}

export function formatMessagingDate(
  date: Date,
  locale: MessagingLocale,
): string {
  return new Intl.DateTimeFormat(intlLocaleFromUserLocale(locale), {
    dateStyle: "long",
  }).format(date);
}

/** Locale WhatsApp / Meta template (`lang`). */
export function messagingLocaleToWhatsAppLang(
  locale: MessagingLocale,
): string {
  return locale;
}

const branchLocaleCache = new Map<string, Promise<MessagingLocale>>();

export function getBranchMessagingLocale(
  branchId: string,
): Promise<MessagingLocale> {
  const existing = branchLocaleCache.get(branchId);
  if (existing) return existing;

  const promise = prisma.branch
    .findUnique({
      where: { id: branchId },
      select: { educationSystem: true, pays: true },
    })
    .then((branch) =>
      resolveBranchMessagingLocale({
        educationSystem: branch?.educationSystem,
        pays: branch?.pays,
      }),
    )
    .catch(() => "fr" as MessagingLocale);

  branchLocaleCache.set(branchId, promise);
  return promise;
}

export async function resolveSenderMessagingLocale(input: {
  locale?: MessagingLocale | null;
  branchId?: string | null;
}): Promise<MessagingLocale> {
  if (input.locale) return normalizeUserLocale(input.locale);
  if (input.branchId) return getBranchMessagingLocale(input.branchId);
  return "fr";
}

export type DayGreetingPeriod = "morning" | "afternoon" | "evening";

/**
 * Salutation selon l’heure (fuseau messagerie, défaut Africa/Kinshasa).
 * Matin &lt; 12 · après-midi &lt; 18 · sinon soir.
 */
export function resolveDayGreetingPeriod(
  now: Date = new Date(),
  timeZone =
    process.env.MESSAGING_TZ?.trim() ||
    process.env.TZ?.trim() ||
    "Africa/Kinshasa",
): DayGreetingPeriod {
  let hour = now.getHours();
  try {
    const raw = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "numeric",
      hour12: false,
    }).format(now);
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) hour = parsed;
  } catch {
    // fuseau invalide → heure locale du process
  }
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** Clé i18n : common.greetingMorning | Afternoon | Evening */
export function dayGreetingMessageKey(
  period: DayGreetingPeriod = resolveDayGreetingPeriod(),
): "common.greetingMorning" | "common.greetingAfternoon" | "common.greetingEvening" {
  if (period === "morning") return "common.greetingMorning";
  if (period === "afternoon") return "common.greetingAfternoon";
  return "common.greetingEvening";
}

/** Une seule salutation dynamique : « Bonsoir Jean, » */
export function formatMessagingHello(
  t: MessagingTranslator,
  name: string,
  now?: Date,
): string {
  const greeting = t(dayGreetingMessageKey(resolveDayGreetingPeriod(now)));
  return t("common.hello", { greeting, name: name.trim() || "…" });
}

export function formatMessagingHelloPlain(
  t: MessagingTranslator,
  name: string,
  now?: Date,
): string {
  const greeting = t(dayGreetingMessageKey(resolveDayGreetingPeriod(now)));
  return t("common.helloPlain", { greeting, name: name.trim() || "…" });
}
