import "server-only";

import fs from "node:fs";
import path from "node:path";

export type WhatsAppEnvKey =
  | "ZINDUA_WHATSAPP_ENABLED"
  | "ZINDUA_API_KEY"
  | "ZINDUA_WHATSAPP_MAIL_TEMPLATE"
  | "ZINDUA_SITE_URL";

/** Met à jour process.env immédiatement (sans attendre un redémarrage). */
export function applyWhatsAppEnvRuntime(
  updates: Partial<Record<WhatsAppEnvKey, string>>,
) {
  for (const [key, value] of Object.entries(updates)) {
    if (value == null) continue;
    process.env[key] = value;
  }
}

/**
 * Synchronise le .env avec la config UI.
 * Les champs vides ne sont pas écrasés (ils restent le repli).
 */
export function syncWhatsAppEnvFile(
  updates: Partial<Record<WhatsAppEnvKey, string>>,
) {
  const entries = (Object.entries(updates) as Array<[WhatsAppEnvKey, string]>).filter(
    ([, value]) => typeof value === "string",
  );
  if (entries.length === 0) return;

  applyWhatsAppEnvRuntime(Object.fromEntries(entries));

  const filePath = path.join(process.cwd(), ".env");
  let content = "";
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    content = "";
  }

  let next = content;
  const missing: string[] = [];

  for (const [key, value] of entries) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    if (pattern.test(next)) {
      next = next.replace(pattern, line);
    } else {
      missing.push(line);
    }
  }

  if (missing.length > 0) {
    next = `${next.replace(/\s*$/, "")}\n${missing.join("\n")}\n`;
  }

  fs.writeFileSync(filePath, next, "utf8");
}
