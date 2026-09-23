import "server-only";

import fs from "node:fs";
import path from "node:path";

export type WhatsAppEnvKey =
  | "WHATSAPP_PROVIDER"
  | "ZINDUA_WHATSAPP_ENABLED"
  | "ZINDUA_API_KEY"
  | "ZINDUA_WHATSAPP_MAIL_TEMPLATE"
  | "ZINDUA_SITE_URL"
  | "MESSAGING_WHATSAPP_ENABLED"
  | "MESSAGING_API_KEY"
  | "MESSAGING_META_API_KEY"
  | "MESSAGING_WHATSAPP_TEMPLATE"
  | "MESSAGING_API_BASE_URL";

const WHATSAPP_ENV_KEYS: readonly WhatsAppEnvKey[] = [
  "WHATSAPP_PROVIDER",
  "ZINDUA_WHATSAPP_ENABLED",
  "ZINDUA_API_KEY",
  "ZINDUA_WHATSAPP_MAIL_TEMPLATE",
  "ZINDUA_SITE_URL",
  "MESSAGING_WHATSAPP_ENABLED",
  "MESSAGING_API_KEY",
  "MESSAGING_META_API_KEY",
  "MESSAGING_WHATSAPP_TEMPLATE",
  "MESSAGING_API_BASE_URL",
];

const KEY_SET = new Set<string>(WHATSAPP_ENV_KEYS);

let envFileCache: { at: number; map: Partial<Record<WhatsAppEnvKey, string>> } | null =
  null;

function envFilePath() {
  return path.join(process.cwd(), ".env");
}

function parseWhatsAppEnvFile(): Partial<Record<WhatsAppEnvKey, string>> {
  let content = "";
  try {
    content = fs.readFileSync(envFilePath(), "utf8");
  } catch {
    return {};
  }
  const map: Partial<Record<WhatsAppEnvKey, string>> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!KEY_SET.has(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[key as WhatsAppEnvKey] = value;
  }
  return map;
}

/** Lit une clé WhatsApp : .env disque d’abord (évite la valeur figée au `next build`). */
export function envRaw(name: WhatsAppEnvKey): string | undefined {
  const now = Date.now();
  if (!envFileCache || now - envFileCache.at > 2000) {
    envFileCache = { at: now, map: parseWhatsAppEnvFile() };
  }
  const fromFile = envFileCache.map[name];
  if (fromFile != null) return fromFile;
  const fromProcess = process.env[name];
  return typeof fromProcess === "string" ? fromProcess : undefined;
}

/** Met à jour process.env immédiatement (sans attendre un redémarrage). */
export function applyWhatsAppEnvRuntime(
  updates: Partial<Record<WhatsAppEnvKey, string>>,
) {
  for (const [key, value] of Object.entries(updates)) {
    if (value == null) continue;
    process.env[key] = value;
  }
  if (envFileCache) {
    envFileCache = {
      at: Date.now(),
      map: { ...envFileCache.map, ...updates },
    };
  }
}

/**
 * Synchronise le .env avec la config UI.
 * Les champs vides ne sont pas écrasés (ils restent le repli).
 */
export function syncWhatsAppEnvFile(
  updates: Partial<Record<WhatsAppEnvKey, string>>,
) {
  const entries = (
    Object.entries(updates) as Array<[WhatsAppEnvKey, string]>
  ).filter(([, value]) => typeof value === "string");
  if (entries.length === 0) return;

  applyWhatsAppEnvRuntime(Object.fromEntries(entries));

  envFileCache = null;
  const filePath = envFilePath();
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
