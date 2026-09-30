import { resolveNotificationChannels } from "@/lib/notification-channels";
import { sendMail } from "@/lib/email/mailer";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  escapeHtml,
  getSignInUrl,
} from "@/lib/email/email-layout";
import { sendTransactionalWhatsApp } from "@/lib/zindua";
import {
  formatMessagingHello,
  getMessagingTranslator,
  resolveSenderMessagingLocale,
} from "@/lib/messaging-locale";
import {
  notifyCardToWhatsAppParts,
  serializeNotifyCard,
} from "@/lib/notify/notify-message-card";
import {
  formatOwnerDailyFinanceMoney,
  formatOwnerDailyFinanceText,
  type OwnerDailyFinanceRecipient,
  type OwnerDailyFinanceSummary,
} from "@/lib/reports/owner-daily-finance-summary";

const APP_NAME = DEFAULT_APP_NAME;

export async function sendOwnerDailyFinanceSummary(input: {
  recipient: OwnerDailyFinanceRecipient;
  summary: OwnerDailyFinanceSummary;
}): Promise<{ email: boolean; whatsapp: boolean }> {
  const email = input.recipient.email?.trim() ?? "";
  const phone = input.recipient.telephone?.trim() ?? "";
  if (!email && !phone) return { email: false, whatsapp: false };

  const allow = await resolveNotificationChannels(
    input.summary.organizationId,
    "ownerDailyFinance",
  );
  if (!allow.email && !allow.whatsapp) {
    return { email: false, whatsapp: false };
  }

  const locale = await resolveSenderMessagingLocale({
    branchId: input.summary.branches[0]?.branchId ?? null,
  });
  const t = await getMessagingTranslator(locale);
  const hello = formatMessagingHello(t, input.recipient.name);
  const textBody = formatOwnerDailyFinanceText(input.summary);
  const subject = `${APP_NAME} — Situation financière du jour (${input.summary.dateLabel})`;
  const introBody = `Voici la situation de caisse et des inscriptions de vos établissements.`;
  const intro = `${hello} ${introBody}`;
  const loginUrl = getSignInUrl();

  const rows = input.summary.branches.map((branch) => ({
    label: branch.branchName,
    valueHtml: escapeHtml(
      `Entrées ${formatOwnerDailyFinanceMoney(branch.income, branch.currency)} · Sorties ${formatOwnerDailyFinanceMoney(branch.expenses, branch.currency)} · Caisse ${formatOwnerDailyFinanceMoney(branch.cashBalance, branch.currency)} · ${branch.newEnrollments} inscrit${branch.newEnrollments === 1 ? "" : "s"}`,
    ),
  }));
  rows.push({
    label: "Total",
    valueHtml: escapeHtml(
      `Caisse ${formatOwnerDailyFinanceMoney(input.summary.totalCashBalance, input.summary.currency)} · ${input.summary.totalNewEnrollments} élève${input.summary.totalNewEnrollments === 1 ? "" : "s"}`,
    ),
  });

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: "Situation financière du jour",
    intro: escapeHtml(intro),
    bodyHtml: emailInfoCard(rows),
    cta: {
      href: loginUrl,
      label: "Ouvrir mon compte",
    },
  });

  const text = [intro, "", textBody, "", `— ${APP_NAME}`].join("\n");

  let emailSent = false;
  if (allow.email && email) {
    try {
      await sendMail({
        to: email,
        organizationId: input.summary.organizationId,
        notificationEvent: "ownerDailyFinance",
        subject,
        text,
        html,
      });
      emailSent = true;
    } catch (error) {
      console.error(
        "[owner-daily-finance] email failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  let whatsappSent = false;
  if (allow.whatsapp && phone) {
    try {
      const card = {
        v: 1 as const,
        tone: "emerald" as const,
        brand: input.summary.organizationName || APP_NAME,
        title: `Situation financière — ${input.summary.dateLabel}`,
        intro: hello,
        rows: [
          ...input.summary.branches.slice(0, 8).map((branch) => ({
            label: branch.branchName,
            value: `Caisse ${formatOwnerDailyFinanceMoney(branch.cashBalance, branch.currency)} · ${branch.newEnrollments} inscrit(s)`,
          })),
          {
            label: "Total",
            value: `Caisse ${formatOwnerDailyFinanceMoney(input.summary.totalCashBalance, input.summary.currency)} · ${input.summary.totalNewEnrollments} élève(s)`,
          },
        ],
        cta: { label: "Ouvrir mon compte", href: loginUrl },
      };
      const wa = await sendTransactionalWhatsApp({
        to: phone,
        organizationId: input.summary.organizationId,
        queueKind: "finance",
        locale,
        parts: notifyCardToWhatsAppParts(card),
        richBody: serializeNotifyCard(card),
      });
      whatsappSent = Boolean(wa.sent);
    } catch (error) {
      console.error(
        "[owner-daily-finance] whatsapp failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return { email: emailSent, whatsapp: whatsappSent };
}
