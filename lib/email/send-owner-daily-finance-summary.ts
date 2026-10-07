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
import { prepareNotifyDelivery } from "@/lib/notify/notify-message-card";
import {
  formatOwnerDailyFinanceDateLabel,
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
  const dateLabel = formatOwnerDailyFinanceDateLabel(
    input.summary.dateKey,
    locale,
  );
  const summary = { ...input.summary, dateLabel };
  const hello = formatMessagingHello(t, input.recipient.name);
  const textBody = formatOwnerDailyFinanceText(summary, t);
  const subject = t("ownerDailyFinance.subject", {
    app: APP_NAME,
    date: dateLabel,
  });
  const intro = `${hello} ${t("ownerDailyFinance.intro")}`.trim();
  const loginUrl = getSignInUrl();

  const rows = summary.branches.map((branch) => ({
    label: branch.branchName,
    valueHtml: escapeHtml(
      t("ownerDailyFinance.branchValue", {
        incomeLabel: t("ownerDailyFinance.income"),
        income: formatOwnerDailyFinanceMoney(branch.income, branch.currency),
        expensesLabel: t("ownerDailyFinance.expenses"),
        expenses: formatOwnerDailyFinanceMoney(
          branch.expenses,
          branch.currency,
        ),
        cashLabel: t("ownerDailyFinance.cash"),
        cash: formatOwnerDailyFinanceMoney(
          branch.cashBalance,
          branch.currency,
        ),
        enrolled: t(
          branch.newEnrollments === 1
            ? "ownerDailyFinance.enrolledOne"
            : "ownerDailyFinance.enrolledMany",
          { count: branch.newEnrollments },
        ),
      }),
    ),
  }));
  rows.push({
    label: t("ownerDailyFinance.total"),
    valueHtml: escapeHtml(
      t("ownerDailyFinance.totalValue", {
        cashLabel: t("ownerDailyFinance.cash"),
        cash: formatOwnerDailyFinanceMoney(
          summary.totalCashBalance,
          summary.currency,
        ),
        students: t(
          summary.totalNewEnrollments === 1
            ? "ownerDailyFinance.studentOne"
            : "ownerDailyFinance.studentMany",
          { count: summary.totalNewEnrollments },
        ),
      }),
    ),
  });

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: t("ownerDailyFinance.title"),
    intro: escapeHtml(intro),
    bodyHtml: emailInfoCard(rows),
    cta: {
      href: loginUrl,
      label: t("common.openAccount"),
    },
  });

  const text = [intro, "", textBody, "", t("common.signatureApp", { app: APP_NAME })].join(
    "\n",
  );

  let emailSent = false;
  if (allow.email && email) {
    try {
      await sendMail({
        to: email,
        organizationId: summary.organizationId,
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
      const { parts, richBody } = prepareNotifyDelivery({
        tone: "emerald",
        brand: summary.organizationName || APP_NAME,
        title: t("ownerDailyFinance.titleWithDate", { date: dateLabel }),
        intro: `${hello} ${t("ownerDailyFinance.waIntro")}`.trim(),
        rows: [
          ...summary.branches.slice(0, 8).map((branch) => ({
            label: branch.branchName,
            value: t("ownerDailyFinance.waBranchCash", {
              cashLabel: t("ownerDailyFinance.cash"),
              cash: formatOwnerDailyFinanceMoney(
                branch.cashBalance,
                branch.currency,
              ),
              enrolled: t("ownerDailyFinance.enrolledParen", {
                count: branch.newEnrollments,
              }),
            }),
          })),
          {
            label: t("ownerDailyFinance.total"),
            value: t("ownerDailyFinance.totalValue", {
              cashLabel: t("ownerDailyFinance.cash"),
              cash: formatOwnerDailyFinanceMoney(
                summary.totalCashBalance,
                summary.currency,
              ),
              students: t("ownerDailyFinance.studentParen", {
                count: summary.totalNewEnrollments,
              }),
            }),
            kind: "highlight" as const,
          },
        ],
        cta: { label: t("common.openAccount"), href: loginUrl },
      });
      const wa = await sendTransactionalWhatsApp({
        to: phone,
        organizationId: summary.organizationId,
        queueKind: "finance",
        locale,
        parts,
        richBody,
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
