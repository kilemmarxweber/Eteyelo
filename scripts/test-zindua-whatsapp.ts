/**
 * Diagnostic + envoi test WhatsApp Zindua (ne log jamais la clé).
 * Usage: pnpm tsx scripts/test-zindua-whatsapp.ts [+243…]
 */
import "dotenv/config";

const TO = process.argv[2]?.trim() || "+243844952966";
const API_KEY_RE = /^znd_(live|test)_[a-z0-9]{24}$/;
const API_BASE = (
  process.env.ZINDUA_API_BASE_URL?.trim() || "https://zindua.run/api/v1"
).replace(/\/$/, "");

function maskKey(key: string): string {
  if (key.length < 16) return `(len=${key.length})`;
  return `${key.slice(0, 12)}…${key.slice(-4)} len=${key.length}`;
}

function siteUrl(): string | undefined {
  const raw =
    process.env.ZINDUA_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "";
  const cleaned = raw.replace(/\/$/, "");
  return cleaned || undefined;
}

async function zinduaFetch(path: string, init?: RequestInit) {
  const apiKey = process.env.ZINDUA_API_KEY?.trim() || "";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  const origin = siteUrl();
  if (origin) headers["X-Zindua-Site-Url"] = origin;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  return { ok: res.ok, status: res.status, json };
}

function redact(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const clone = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const rec = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(rec)) {
      if (/key|secret|token|authorization/i.test(k) && typeof v === "string") {
        rec[k] = maskKey(v);
      } else {
        walk(v);
      }
    }
  };
  walk(clone);
  return clone;
}

async function main() {
  const apiKey = process.env.ZINDUA_API_KEY?.trim() || "";
  const enabled = process.env.ZINDUA_WHATSAPP_ENABLED?.trim() || "(unset=true)";
  const template =
    process.env.ZINDUA_WHATSAPP_MAIL_TEMPLATE?.trim() || "notification";

  console.log("=== Config locale (sans secret) ===");
  console.log("enabled:", enabled);
  console.log("template:", template);
  console.log("siteUrl:", siteUrl() ?? "(none)");
  console.log("apiKey:", apiKey ? maskKey(apiKey) : "(MISSING)");
  console.log("apiKey matches SDK regex:", API_KEY_RE.test(apiKey));
  console.log("to:", TO);
  console.log("apiBase:", API_BASE);

  if (!apiKey) {
    console.error("ZINDUA_API_KEY manquante dans .env");
    process.exit(1);
  }

  console.log("\n=== GET /project ===");
  const project = await zinduaFetch("/project");
  console.log("HTTP", project.status);
  console.log(JSON.stringify(redact(project.json), null, 2));

  console.log("\n=== GET /templates ===");
  const templates = await zinduaFetch("/templates");
  console.log("HTTP", templates.status);
  console.log(JSON.stringify(redact(templates.json), null, 2));

  const payload = {
    to: TO,
    channel: "whatsapp",
    template,
    lang: "fr",
    variables: {
      appName: "Klambocore",
      name: "Test",
      code: "Test Zindua Klambocore — message de vérification. Ignorez si vous n'êtes pas concerné.",
    },
  };

  console.log("\n=== POST /send (même forme que l'app) ===");
  const sent = await zinduaFetch("/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  console.log("HTTP", sent.status);
  console.log(JSON.stringify(redact(sent.json), null, 2));

  if (sent.ok) {
    const logId =
      sent.json && typeof sent.json === "object" && "logId" in sent.json
        ? String((sent.json as { logId?: string }).logId ?? "")
        : "";
    if (logId) {
      console.log("\n=== GET /logs/" + logId + " ===");
      await new Promise((r) => setTimeout(r, 2000));
      const log = await zinduaFetch(`/logs/${logId}`);
      console.log("HTTP", log.status);
      console.log(JSON.stringify(redact(log.json), null, 2));
    }
  }
}

main().catch((error) => {
  console.error("fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
