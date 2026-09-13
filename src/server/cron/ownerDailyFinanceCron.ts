import cron from "node-cron";
import { APP_TIMEZONE } from "@/lib/timezone";
import {
  buildOwnerDailyFinanceSummary,
  getOrganizationOwnerRecipients,
  hasOwnerDailyFinanceActivity,
  isOwnerDailyFinanceSunday,
  listOrganizationsForOwnerDailyFinance,
  shouldSkipOwnerDailyFinanceReport,
} from "@/lib/reports/owner-daily-finance-summary";
import { sendOwnerDailyFinanceSummary } from "@/lib/email/send-owner-daily-finance-summary";

let started = false;
let running = false;

export async function runOwnerDailyFinanceCron(now = new Date()) {
  if (running) {
    console.log("[owner-daily-finance] skipped: already running");
    return { organizations: 0, sent: 0, skipped: 0 };
  }

  if (isOwnerDailyFinanceSunday(now)) {
    console.log("[owner-daily-finance] skipped: sunday");
    return { organizations: 0, sent: 0, skipped: 0 };
  }

  running = true;
  let organizations = 0;
  let sent = 0;
  let skipped = 0;

  try {
    const orgs = await listOrganizationsForOwnerDailyFinance();
    organizations = orgs.length;

    for (const org of orgs) {
      try {
        const quiet = await shouldSkipOwnerDailyFinanceReport({
          organizationId: org.id,
          now,
        });
        if (quiet.skip) {
          skipped += 1;
          continue;
        }

        const summary = await buildOwnerDailyFinanceSummary({
          organizationId: org.id,
          now,
        });
        if (!hasOwnerDailyFinanceActivity(summary)) {
          skipped += 1;
          continue;
        }

        const recipients = await getOrganizationOwnerRecipients(org.id);
        if (recipients.length === 0) {
          skipped += 1;
          continue;
        }

        for (const recipient of recipients) {
          if (!recipient.email && !recipient.telephone) continue;
          const result = await sendOwnerDailyFinanceSummary({
            recipient,
            summary: summary!,
          });
          if (result.email || result.whatsapp) sent += 1;
        }
      } catch (error) {
        console.error(
          `[owner-daily-finance] org=${org.id} failed`,
          error,
        );
      }
    }
  } finally {
    running = false;
  }

  return { organizations, sent, skipped };
}

/** Lun–sam à 17:55 (fuseau établissement) — jamais dimanche ni jour férié. */
export function startOwnerDailyFinanceCron() {
  if (started) return;
  started = true;

  cron.schedule(
    "55 17 * * 1-6",
    async () => {
      try {
        const result = await runOwnerDailyFinanceCron();
        console.log(
          `[owner-daily-finance] orgs=${result.organizations} sent=${result.sent} skipped=${result.skipped}`,
        );
      } catch (error) {
        console.error("[owner-daily-finance] cron failed", error);
      }
    },
    { timezone: APP_TIMEZONE },
  );

  console.log(
    `⏰ Owner daily finance cron started (17:55 Mon–Sat ${APP_TIMEZONE})`,
  );
}
