/**
 * Les adresses @klambocore.com générées à l'inscription (élève/parent)
 * sont des identifiants de connexion, pas des boîtes mail. N'envoyer du SMTP
 * que vers les deux boîtes réelles, sinon Zoho/Gmail suspend le compte
 * (rebonds = activité « spam »).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REAL_KLAMBOCORE_MAILBOXES = [
  "contact@klambocore.com",
  "kilem@klambocore.com",
] as const;

/** Identifiants RH générés : student.prenom.n@gmail.com, etc. */
const GENERATED_GMAIL_RE =
  /^(student|parent|teacher|personnel)\.[^@]+@gmail\.com$/i;

const BLOCKED_DOMAINS = new Set([
  "exemple.com",
  "example.com",
  "example.org",
  "example.net",
  "example.fr",
  "demoinbox.net",
  "test.com",
  "invalid",
  "localhost",
  "mailinator.com",
  "guerrillamail.com",
  "yopmail.com",
  "tempmail.com",
]);

const BLOCKED_TLDS = new Set(["test", "invalid", "example", "localhost"]);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function extraAllowlistedMailboxes(): string[] {
  const raw = [
    process.env.SMTP_USER,
    process.env.CONTACT_EMAIL,
    process.env.KLAMBOCORE_MAILBOX_ALLOWLIST,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(",");

  return raw
    .split(",")
    .map((part) => normalizeEmail(part))
    .filter(Boolean);
}

/**
 * True seulement si l'adresse peut réellement recevoir un email.
 * - @klambocore.com : contact@, kilem@, plus SMTP_USER / CONTACT_EMAIL / KLAMBOCORE_MAILBOX_ALLOWLIST
 * - *.local / exemple.com / demoinbox.net / yopmail… : jamais
 * - student.|parent.|teacher.|personnel.*@gmail.com : jamais (placeholders RH)
 */
export function isDeliverableMailbox(
  email: string | null | undefined,
): boolean {
  const value = email?.trim() ?? "";
  if (!EMAIL_RE.test(value)) return false;

  const normalized = normalizeEmail(value);
  const domain = normalized.split("@")[1] ?? "";

  if (domain.endsWith(".local")) return false;
  if (BLOCKED_DOMAINS.has(domain)) return false;

  const tld = domain.split(".").pop() ?? "";
  if (BLOCKED_TLDS.has(tld)) return false;

  if (domain === "klambocore.com") {
    const allowlist = new Set<string>([
      ...REAL_KLAMBOCORE_MAILBOXES,
      ...extraAllowlistedMailboxes(),
    ]);
    return allowlist.has(normalized);
  }

  if (GENERATED_GMAIL_RE.test(normalized)) return false;

  return true;
}
