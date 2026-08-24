#!/usr/bin/env tsx
/**
 * Vérifie que fr / en / pt ont les mêmes clés JSON (namespaces i18n).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "messages");
const LOCALES = ["fr", "en", "pt"] as const;

function flatten(
  value: unknown,
  prefix = "",
  out = new Set<string>(),
): Set<string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      flatten(nested, prefix ? `${prefix}.${key}` : key, out);
    }
  } else if (prefix) {
    out.add(prefix);
  }
  return out;
}

function main() {
  const namespaces = readdirSync(join(ROOT, "fr")).filter((f) =>
    f.endsWith(".json"),
  );
  let failed = false;

  for (const ns of namespaces) {
    const maps = Object.fromEntries(
      LOCALES.map((locale) => {
        const raw = readFileSync(join(ROOT, locale, ns), "utf8");
        return [locale, flatten(JSON.parse(raw))];
      }),
    ) as Record<(typeof LOCALES)[number], Set<string>>;

    const base = maps.fr;
    for (const locale of LOCALES) {
      if (locale === "fr") continue;
      for (const key of base) {
        if (!maps[locale].has(key)) {
          console.error(`[missing] ${locale}/${ns} → ${key}`);
          failed = true;
        }
      }
      for (const key of maps[locale]) {
        if (!base.has(key)) {
          console.error(`[extra] ${locale}/${ns} → ${key}`);
          failed = true;
        }
      }
    }
  }

  if (failed) {
    process.exit(1);
  }
  console.log(`i18n:check OK (${namespaces.length} namespaces × ${LOCALES.length} locales)`);
}

main();
