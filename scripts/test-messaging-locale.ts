/**
 * Locale messagerie branche (fr / en / pt).
 * Run: pnpm exec tsx scripts/test-messaging-locale.ts
 */
import "../src/workers/stub-server-only";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  resolveBranchMessagingLocale,
  resolveMessagingLocaleForUser,
  messagingLocaleToWhatsAppLang,
} from "../lib/messaging-locale";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

function flatten(
  value: unknown,
  prefix = "",
  out = new Set<string>(),
): Set<string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      flatten(nested, prefix ? `${prefix}.${key}` : key, out);
    }
  } else if (prefix) {
    out.add(prefix);
  }
  return out;
}

test("ANGOLAIS → pt", () => {
  assert.equal(
    resolveBranchMessagingLocale({ educationSystem: "ANGOLAIS" }),
    "pt",
  );
});

test("ANGLAIS → en", () => {
  assert.equal(
    resolveBranchMessagingLocale({ educationSystem: "ANGLAIS" }),
    "en",
  );
});

test("CONGOLAIS / défaut → fr", () => {
  assert.equal(
    resolveBranchMessagingLocale({ educationSystem: "CONGOLAIS" }),
    "fr",
  );
  assert.equal(resolveBranchMessagingLocale({}), "fr");
});

test("pays Angola → pt (filet)", () => {
  assert.equal(
    resolveBranchMessagingLocale({
      educationSystem: "CONGOLAIS",
      pays: "Angola",
    }),
    "pt",
  );
  assert.equal(
    resolveBranchMessagingLocale({ educationSystem: "ANGLAIS", pays: "AO" }),
    "pt",
  );
});

test("auth : branche prime sur User.locale", () => {
  assert.equal(
    resolveMessagingLocaleForUser({
      branch: { educationSystem: "ANGLAIS" },
      userLocale: "fr",
    }),
    "en",
  );
  assert.equal(
    resolveMessagingLocaleForUser({
      branch: null,
      userLocale: "pt",
    }),
    "pt",
  );
});

test("salutation dynamique matin / après-midi / soir", async () => {
  const {
    resolveDayGreetingPeriod,
  } = await import("../lib/messaging-locale");
  assert.equal(
    resolveDayGreetingPeriod(new Date("2026-06-15T08:00:00+01:00")),
    "morning",
  );
  assert.equal(
    resolveDayGreetingPeriod(new Date("2026-06-15T15:00:00+01:00")),
    "afternoon",
  );
  assert.equal(
    resolveDayGreetingPeriod(new Date("2026-06-15T20:00:00+01:00")),
    "evening",
  );
});

test("WhatsApp lang = locale", () => {
  assert.equal(messagingLocaleToWhatsAppLang("pt"), "pt");
  assert.equal(messagingLocaleToWhatsAppLang("en"), "en");
  assert.equal(messagingLocaleToWhatsAppLang("fr"), "fr");
});


test("catalogues notifications V1 : mêmes clés fr/en/pt", () => {
  const requiredPrefixes = [
    "common.greetingMorning",
    "common.greetingAfternoon",
    "common.greetingEvening",
    "attendance.absence",
    "attendance.justification_submitted",
    "attendance.justification_received",
    "attendance.accepted",
    "attendance.rejected",
    "attendance.return",
    "payment.created",
    "payment.updated",
    "payment.deleted",
    "results.",
    "accountCreate.",
    "passwordReset.",
    "teacherSchedule.",
    "ownerDailyFinance.",
    "payroll.",
    "profileUpdate.",
    "invitation.",
    "emailVerification.",
    "branchSubmission.",
    "jobApplication.",
    "schoolRegistration.",
    "common.branchAddress",
    "common.teacher",
    "common.staff",
  ];
  const root = join(process.cwd(), "messages");
  const maps = (["fr", "en", "pt"] as const).map((locale) => {
    const raw = readFileSync(join(root, locale, "notifications.json"), "utf8");
    return { locale, keys: flatten(JSON.parse(raw)) };
  });
  const base = maps[0].keys;
  for (const { locale, keys } of maps.slice(1)) {
    for (const key of base) {
      assert.ok(keys.has(key), `missing ${locale}: ${key}`);
    }
    for (const key of keys) {
      assert.ok(base.has(key), `extra ${locale}: ${key}`);
    }
  }
  for (const prefix of requiredPrefixes) {
    const hit = [...base].some(
      (key) => key === prefix.replace(/\.$/, "") || key.startsWith(prefix),
    );
    assert.ok(hit, `missing V1 prefix ${prefix}`);
  }
});

console.log("\nAll messaging-locale tests passed.");
