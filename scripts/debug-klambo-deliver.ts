/**
 * Debug : pourquoi deliverSchoolNotify n'atteint pas l'inbox.
 * Run: npx tsx scripts/debug-klambo-deliver.ts [phone]
 */
import "dotenv/config";
import { createRequire } from "node:module";

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
import { findUserByTelephone } from "../lib/mobile/session";
import { normalizePhoneE164, phoneLookupVariants } from "../lib/mobile/phone";
import { deliverSchoolNotify } from "../lib/notify/deliver-school-notify";
import { isEligibleMessagingRecipient } from "../lib/messaging/messaging-policy";
import { isOrganizationMessagingEnabled } from "../lib/messaging/messaging-service";

async function main() {
  const raw = process.argv[2]?.trim() || "+243897517455";
  const e164 = normalizePhoneE164(raw);
  console.log("NOTIFY_KLAMBO_APP_FIRST=", process.env.NOTIFY_KLAMBO_APP_FIRST ?? "(default on)");
  console.log("phone raw=", raw, "e164=", e164);
  console.log("lookup variants=", e164 ? phoneLookupVariants(e164) : []);

  if (!e164) {
    console.error("numéro invalide");
    process.exit(1);
  }

  const user = await findUserByTelephone(e164);
  console.log(
    "user=",
    user
      ? {
          id: user.id,
          telephone: user.telephone,
          banned: user.banned,
          statusUser: user.statusUser,
          name: [user.prenom, user.name].filter(Boolean).join(" "),
        }
      : null,
  );

  if (!user) {
    // Cherche approximatif
    const digits = e164.replace(/\D/g, "").slice(-9);
    const fuzzy = await prisma.user.findMany({
      where: { telephone: { contains: digits } },
      take: 5,
      select: { id: true, telephone: true, email: true, name: true },
    });
    console.log("fuzzy telephone contains last9=", fuzzy);
    process.exit(1);
  }

  const members = await prisma.member.findMany({
    where: { userId: user.id, isArchived: false },
    select: {
      organizationId: true,
      role: true,
      organization: { select: { name: true, messagingEnabled: true } },
    },
  });
  console.log("members=", members);

  const orgId = members[0]?.organizationId;
  if (!orgId) {
    console.error("pas de membership");
    process.exit(1);
  }

  const messagingEnabled = await isOrganizationMessagingEnabled(orgId);
  console.log("messagingEnabled=", messagingEnabled);

  const eligible = isEligibleMessagingRecipient({
    memberRole: members[0]?.role,
    userBanned: user.banned,
    statusUser: user.statusUser,
  });
  console.log("eligible=", eligible, "role=", members[0]?.role);

  const stamp = `DEBUG-INBOX-${Date.now()}`;
  const result = await deliverSchoolNotify({
    to: user.telephone || e164,
    organizationId: orgId,
    queueKind: "credentials",
    parts: [`Test inbox Klambo`, stamp],
  });
  console.log("deliver result=", result);

  const msg = await prisma.message.findFirst({
    where: {
      body: { contains: stamp },
      conversation: {
        organizationId: orgId,
        participants: { some: { userId: user.id, leftAt: null } },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      body: true,
      senderId: true,
      conversationId: true,
      createdAt: true,
    },
  });
  console.log("message in DB=", msg);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
