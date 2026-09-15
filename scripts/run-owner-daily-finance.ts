/**
 * Diagnostic + envoi forcé du rapport finance propriétaire (17h55).
 *
 * Usage:
 *   pnpm exec tsx scripts/run-owner-daily-finance.ts
 *   pnpm exec tsx scripts/run-owner-daily-finance.ts --force
 *   pnpm exec tsx scripts/run-owner-daily-finance.ts --force --org=<organizationId>
 */
import "../src/workers/stub-server-only";

import { prisma } from "../lib/prisma";
import { resolveNotificationChannels } from "../lib/notification-channels";
import {
  buildOwnerDailyFinanceSummary,
  formatOwnerDailyFinanceText,
  getOrganizationOwnerRecipients,
  hasOwnerDailyFinanceActivity,
  isOwnerDailyFinanceSunday,
  listOrganizationsForOwnerDailyFinance,
  shouldSkipOwnerDailyFinanceReport,
} from "../lib/reports/owner-daily-finance-summary";
import { sendOwnerDailyFinanceSummary } from "../lib/email/send-owner-daily-finance-summary";
import { APP_TIMEZONE } from "../lib/timezone";
import { ORG_ROLE } from "../lib/permissions";

const force = process.argv.includes("--force");
const orgArg = process.argv.find((arg) => arg.startsWith("--org="));
const onlyOrgId = orgArg?.slice("--org=".length)?.trim() || null;

type OrgRef = { id: string; name: string };
type BranchRef = { id: string; name: string };

async function diagnoseOrg(org: OrgRef) {
  console.log(`\n===== ${org.name} (${org.id}) =====`);

  const members = await prisma.member.findMany({
    where: { organizationId: org.id, isArchived: false },
    select: {
      role: true,
      user: {
        select: {
          id: true,
          email: true,
          telephone: true,
          name: true,
          role: true,
        },
      },
    },
  });

  console.log("Membres (rôle org / user.role / email / téléphone):");
  for (const row of members) {
    console.log(
      `  - orgRole="${row.role}" user.role="${row.user.role ?? ""}" email=${row.user.email ?? "—"} tel=${row.user.telephone ?? "—"} name=${row.user.name}`,
    );
  }

  const owners = await getOrganizationOwnerRecipients(org.id);
  console.log(
    `Destinataires détectés (propriétaire / gestionnaire): ${owners.length}`,
  );
  for (const owner of owners) {
    console.log(
      `  → ${owner.name} | ${owner.email ?? "pas d'email"} | ${owner.telephone ?? "pas de tel"}`,
    );
  }
  if (owners.length === 0) {
    console.log(
      `  ⚠ Aucun membre avec rôle « ${ORG_ROLE.OWNER} » / proprietaire ou « ${ORG_ROLE.GESTIONNAIRE} ».`,
    );
  }

  const channels = await resolveNotificationChannels(
    org.id,
    "ownerDailyFinance",
  );
  console.log(
    `Canaux ownerDailyFinance: email=${channels.email} whatsapp=${channels.whatsapp}`,
  );

  const quiet = await shouldSkipOwnerDailyFinanceReport({
    organizationId: org.id,
  });
  console.log(`Skip calendrier: ${quiet.skip ? quiet.reason : "non"}`);

  const summary = await buildOwnerDailyFinanceSummary({
    organizationId: org.id,
  });
  const hasActivity = hasOwnerDailyFinanceActivity(summary);
  console.log(
    `Activité du jour: ${hasActivity ? "oui" : "non"} (branches actives dans le résumé: ${summary?.branches.length ?? 0})`,
  );
  if (summary) {
    console.log("--- Aperçu ---");
    console.log(formatOwnerDailyFinanceText(summary));
  }

  return { owners, channels, quiet, summary, hasActivity };
}

async function main() {
  console.log(`Fuseau: ${APP_TIMEZONE}`);
  console.log(`Maintenant: ${new Date().toISOString()}`);
  console.log(`Dimanche (app TZ)? ${isOwnerDailyFinanceSunday()}`);
  console.log(`Mode force: ${force}`);
  console.log(
    "Note: le cron 17:55 ne tourne QUE si `pnpm worker` est démarré (pas dans `pnpm dev` seul).",
  );

  let orgs: OrgRef[] = await listOrganizationsForOwnerDailyFinance();
  if (onlyOrgId) {
    orgs = orgs.filter((org: OrgRef) => org.id === onlyOrgId);
    if (!orgs.length) {
      const one = await prisma.organization.findUnique({
        where: { id: onlyOrgId },
        select: { id: true, name: true },
      });
      if (one) orgs = [one];
    }
  }

  if (!orgs.length) {
    console.log("Aucune organisation trouvée.");
    return;
  }

  let sent = 0;
  let skipped = 0;

  for (const org of orgs) {
    const diag = await diagnoseOrg(org);

    if (!force) {
      if (diag.quiet.skip || !diag.hasActivity || diag.owners.length === 0) {
        skipped += 1;
        continue;
      }
    }

    let summary = diag.summary;
    if (force && !summary) {
      const { dayRangeInAppTimezone } = await import("../lib/timezone");
      const { getBaseCurrency } = await import("../lib/exchange-rate");
      const now = new Date();
      const { dateKey } = dayRangeInAppTimezone(now);
      const organization = await prisma.organization.findUnique({
        where: { id: org.id },
        select: {
          id: true,
          name: true,
          branches: {
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          },
        },
      });
      if (!organization?.branches.length) {
        console.log("  ⚠ Aucune branche active.");
        skipped += 1;
        continue;
      }
      const [selectedExchangeRate, exchangeRates] = await Promise.all([
        prisma.exchangeRate.findFirst({
          where: { organizationId: org.id, isSelected: true },
          select: { fromCurrency: true },
        }),
        prisma.exchangeRate.findMany({
          where: { organizationId: org.id, isActive: true },
          select: {
            fromCurrency: true,
            toCurrency: true,
            rate: true,
            isActive: true,
            isSelected: true,
          },
        }),
      ]);
      const currency =
        selectedExchangeRate?.fromCurrency ?? getBaseCurrency(exchangeRates);
      const dateLabel = new Intl.DateTimeFormat("fr-FR", {
        timeZone: APP_TIMEZONE,
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(now);

      summary = {
        organizationId: organization.id,
        organizationName: organization.name,
        dateKey,
        dateLabel,
        currency,
        branches: organization.branches.map((branch: BranchRef) => ({
          branchId: branch.id,
          branchName: branch.name,
          income: 0,
          expenses: 0,
          cashBalance: 0,
          newEnrollments: 0,
          currency,
        })),
        totalIncome: 0,
        totalExpenses: 0,
        totalCashBalance: 0,
        totalNewEnrollments: 0,
      };
      console.log(
        `  (force) résumé test généré (${organization.branches.length} branche(s), même sans activité / jour férié)`,
      );
    }

    if (!summary) {
      skipped += 1;
      continue;
    }

    let recipients = diag.owners;
    if (force && recipients.length === 0) {
      const fallback = await prisma.member.findFirst({
        where: {
          organizationId: org.id,
          isArchived: false,
          user: { email: { not: null } },
        },
        select: {
          role: true,
          user: {
            select: {
              id: true,
              email: true,
              telephone: true,
              name: true,
              prenom: true,
              postnom: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });
      if (fallback?.user) {
        const name = [
          fallback.user.prenom,
          fallback.user.name,
          fallback.user.postnom,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
        recipients = [
          {
            userId: fallback.user.id,
            email: fallback.user.email?.trim().toLowerCase() || null,
            telephone: fallback.user.telephone,
            name: name || fallback.user.name,
          },
        ];
        console.log(
          `  (force) aucun owner — fallback sur membre role="${fallback.role}" ${recipients[0].email}`,
        );
      }
    }

    if (!recipients.length) {
      console.log("  ⚠ Pas de destinataire.");
      skipped += 1;
      continue;
    }

    // En test forcé : priorité à kilem@ si présent, sinon tous les owners.
    if (force) {
      const preferred = recipients.filter((r) =>
        (r.email ?? "").includes("kilem@klambocore.com"),
      );
      if (preferred.length) {
        recipients = preferred;
        console.log("  (force) envoi ciblé sur kilem@klambocore.com");
      }
    }

    for (const recipient of recipients) {
      if (!recipient.email && !recipient.telephone) continue;
      try {
        const result = await sendOwnerDailyFinanceSummary({
          recipient,
          summary,
        });
        console.log(
          `  Envoi → ${recipient.email ?? recipient.telephone}: email=${result.email} whatsapp=${result.whatsapp}`,
        );
        if (result.email || result.whatsapp) sent += 1;
        else {
          console.log(
            "  ⚠ Canaux désactivés (emailNotificationsEnabled / notificationChannels.ownerDailyFinance / WhatsApp).",
          );
        }
      } catch (error) {
        console.error("  ✗ Envoi échoué", error);
      }
    }
  }

  console.log(`\nTerminé. sent=${sent} skipped=${skipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
