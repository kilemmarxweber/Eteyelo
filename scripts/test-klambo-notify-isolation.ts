/**
 * Integration : deliverSchoolNotify → inbox Klambo par téléphone,
 * + isolement (chaque destinataire ne voit que son message dédié).
 *
 * Usage:
 *   pnpm exec tsx scripts/test-klambo-notify-isolation.ts
 *   pnpm exec tsx scripts/test-klambo-notify-isolation.ts +243844952966 +243971651881
 *
 * Env optionnel :
 *   KLAMBO_TEST_PHONES=+243…,+243…
 *   KLAMBO_TEST_ORG_ID=<cuid>
 */
import "dotenv/config";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

// Scripts Node : neutraliser le garde `server-only` (utilisé par zindua fallback).
{
  const require = createRequire(import.meta.url);
  const resolved = require.resolve("server-only");
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: {},
  } as NodeModule;
}

import { prisma } from "../lib/prisma";
import { deliverSchoolNotify } from "../lib/notify/deliver-school-notify";
import { findUserByTelephone } from "../lib/mobile/session";
import { normalizePhoneE164 } from "../lib/mobile/phone";
import { ORG_ROLE } from "../lib/permissions";

function resolvePhone(raw: string): string | null {
  const e164 = normalizePhoneE164(raw);
  if (!e164) return null;
  const digits = e164.replace(/\D/g, "");
  if (digits.length < 11) return null;
  if (/^2430+$/.test(digits)) return null;
  return e164;
}
function parsePhones(): string[] {
  const fromArgs = process.argv.slice(2).map((p) => p.trim()).filter(Boolean);
  if (fromArgs.length) return fromArgs;
  const env = process.env.KLAMBO_TEST_PHONES?.trim();
  if (env) {
    return env.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
  }
  return ["+243844952966", "+243971651881"];
}

async function discoverMembersWithPhone(limit = 4) {
  const forcedOrg = process.env.KLAMBO_TEST_ORG_ID?.trim() || null;
  const members = await prisma.member.findMany({
    where: {
      isArchived: false,
      ...(forcedOrg ? { organizationId: forcedOrg } : {}),
      organization: { isArchived: false },
      user: {
        banned: { not: true },
        OR: [{ statusUser: true }, { statusUser: null }],
        telephone: { not: null },
      },
    },
    take: 40,
    orderBy: { createdAt: "asc" },
    select: {
      organizationId: true,
      role: true,
      user: {
        select: {
          id: true,
          telephone: true,
          prenom: true,
          name: true,
        },
      },
    },
  });

  const out: Array<{
    phone: string;
    userId: string;
    organizationId: string;
    role: string | null;
    name: string;
  }> = [];

  for (const m of members) {
    const phone = resolvePhone(m.user.telephone ?? "");
    if (!phone) continue;
    // besoin d'un autre membre pour envoyer
    const otherSender = await prisma.member.findFirst({
      where: {
        organizationId: m.organizationId,
        isArchived: false,
        userId: { not: m.user.id },
      },
      select: { id: true },
    });
    if (!otherSender) continue;
    out.push({
      phone,
      userId: m.user.id,
      organizationId: m.organizationId,
      role: m.role,
      name:
        [m.user.prenom, m.user.name].filter(Boolean).join(" ") || phone,
    });
    if (out.length >= limit) break;
  }
  return out;
}

async function resolveTargets(phones: string[]) {
  const targets: Array<{
    phone: string;
    userId: string;
    organizationId: string;
    role: string | null;
    name: string;
  }> = [];

  const forcedOrg = process.env.KLAMBO_TEST_ORG_ID?.trim() || null;

  for (const raw of phones) {
    const phone = resolvePhone(raw);
    if (!phone) {
      console.warn(`skip numéro invalide: ${raw}`);
      continue;
    }
    const user = await findUserByTelephone(phone);
    if (!user) {
      console.warn(`skip: aucun user pour ${phone}`);
      continue;
    }

    const member = await prisma.member.findFirst({
      where: {
        userId: user.id,
        isArchived: false,
        ...(forcedOrg ? { organizationId: forcedOrg } : {}),
        organization: { isArchived: false },
      },
      orderBy: { createdAt: "asc" },
      select: {
        organizationId: true,
        role: true,
      },
    });

    if (!member) {
      console.warn(`skip: ${phone} user=${user.id} sans membership org`);
      continue;
    }

    const otherSender = await prisma.member.findFirst({
      where: {
        organizationId: member.organizationId,
        isArchived: false,
        userId: { not: user.id },
      },
      select: { userId: true },
    });
    if (!otherSender) {
      console.warn(
        `skip: ${phone} org=${member.organizationId} — aucun autre membre pour envoyer`,
      );
      continue;
    }

    targets.push({
      phone,
      userId: user.id,
      organizationId: member.organizationId,
      role: member.role,
      name: [user.prenom, user.name].filter(Boolean).join(" ") || phone,
    });
  }

  if (targets.length < 2) {
    console.log(
      "\nMoins de 2 cibles via CLI — découverte auto des membres avec téléphone…",
    );
    const discovered = await discoverMembersWithPhone(4);
    for (const d of discovered) {
      if (targets.some((t) => t.userId === d.userId)) continue;
      targets.push(d);
      if (targets.length >= 2) break;
    }
  }

  return targets;
}

async function latestBodyForUser(params: {
  organizationId: string;
  userId: string;
  contains: string;
}) {
  const message = await prisma.message.findFirst({
    where: {
      deletedAt: null,
      body: { contains: params.contains },
      conversation: {
        organizationId: params.organizationId,
        deletedAt: null,
        participants: {
          some: { userId: params.userId, leftAt: null },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      body: true,
      conversationId: true,
      conversation: {
        select: {
          participants: {
            where: { leftAt: null },
            select: { userId: true },
          },
        },
      },
    },
  });
  return message;
}

async function main() {
  console.log("=== Klambo notify isolation ===");
  console.log("NOTIFY_KLAMBO_APP_FIRST:", process.env.NOTIFY_KLAMBO_APP_FIRST ?? "(défaut=on)");

  const phones = parsePhones();
  console.log("phones demandés:", phones.join(", "));

  const targets = await resolveTargets(phones);
  if (targets.length < 1) {
    console.error(
      "Aucun destinataire joignable (user+membre+owner). Vérifiez les numéros en DB.",
    );
    process.exit(1);
  }

  console.log("\nDestinataires résolus:");
  for (const t of targets) {
    console.log(
      `  ${t.phone} → user=${t.userId.slice(0, 8)}… org=${t.organizationId.slice(0, 8)}… role=${t.role} (${t.name})`,
    );
  }

  const stamp = randomBytes(4).toString("hex");
  const secrets = new Map<string, string>();

  console.log("\n=== Envoi deliverSchoolNotify ===");
  for (const t of targets) {
    const secret = `KLAMBO-ISO-${stamp}-${t.userId.slice(0, 8)}`;
    secrets.set(t.userId, secret);
    const result = await deliverSchoolNotify({
      to: t.phone,
      organizationId: t.organizationId,
      queueKind: "test",
      parts: [
        `Test isolation Klambo`,
        `Destinataire: ${t.phone}`,
        `Code dédié: ${secret}`,
        `Ne partagez pas ce code.`,
      ],
    });
    console.log(
      `  → ${t.phone}: sent=${result.sent} channel=${result.channel}${result.error ? ` error=${result.error}` : ""}`,
    );
    assert.equal(
      result.sent,
      true,
      `échec envoi pour ${t.phone}: ${result.error ?? "?"}`,
    );
    assert.equal(
      result.channel,
      "klambo",
      `attendu channel=klambo pour ${t.phone}, reçu ${result.channel} (fallback WA ? user/membership ?)`,
    );
  }

  console.log("\n=== Vérif présence message dédié ===");
  for (const t of targets) {
    const secret = secrets.get(t.userId)!;
    const msg = await latestBodyForUser({
      organizationId: t.organizationId,
      userId: t.userId,
      contains: secret,
    });
    assert.ok(msg, `message dédié introuvable pour ${t.phone}`);
    assert.ok(
      msg!.body.includes(secret),
      `corps sans secret pour ${t.phone}`,
    );
    assert.ok(
      msg!.body.includes(t.phone),
      `corps sans numéro destinataire pour ${t.phone}`,
    );
    const participantIds = new Set(
      msg!.conversation.participants.map((p) => p.userId),
    );
    assert.ok(
      participantIds.has(t.userId),
      `destinataire absent des participants (${t.phone})`,
    );
    console.log(`  ✓ ${t.phone} voit son secret ${secret}`);
  }

  if (targets.length >= 2) {
    console.log("\n=== Sécurité : pas de fuite croisée (destinataires) ===");
    for (let i = 0; i < targets.length; i++) {
      const self = targets[i]!;
      for (let j = 0; j < targets.length; j++) {
        if (i === j) continue;
        const other = targets[j]!;
        if (self.organizationId !== other.organizationId) continue;

        const otherSecret = secrets.get(other.userId)!;
        const leaked = await latestBodyForUser({
          organizationId: self.organizationId,
          userId: self.userId,
          contains: otherSecret,
        });
        assert.equal(
          leaked,
          null,
          `FUITE: ${self.phone} voit le secret de ${other.phone} (${otherSecret})`,
        );

        // Le destinataire A ne doit pas être participant de la conversation de B
        if (leaked === null) {
          const otherMsg = await latestBodyForUser({
            organizationId: other.organizationId,
            userId: other.userId,
            contains: otherSecret,
          });
          assert.ok(otherMsg, "message autre manquant");
          const participants = new Set(
            otherMsg!.conversation.participants.map((p) => p.userId),
          );
          assert.equal(
            participants.has(self.userId),
            false,
            `FUITE participants: ${self.phone} est dans la conversation de ${other.phone}`,
          );
        }

        console.log(
          `  ✓ ${self.phone} ne voit PAS le secret de ${other.phone}`,
        );
      }
    }
  } else {
    console.log(
      "\n(seulement 1 destinataire — isolation croisée non testée ; passez 2 numéros)",
    );
  }

  console.log("\nOK — messages Klambo dédiés + isolation OK");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("fatal:", error instanceof Error ? error.message : error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
