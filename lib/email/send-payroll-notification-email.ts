import {
  formatMessagingDate,
  formatMessagingHello,
  getMessagingTranslator,
  resolveSenderMessagingLocale,
  type MessagingLocale,
} from "@/lib/messaging-locale";
import { intlLocaleFromUserLocale } from "@/lib/user-locale";
import { emailInfoCard, emailLayoutHtml, escapeHtml } from "@/lib/email/email-layout";
import { sendMail } from "@/lib/email/mailer";
import { CURRENCY_LABELS } from "@/lib/exchange-rate";
import { prepareNotifyDelivery } from "@/lib/notify/notify-message-card";
import { sendTransactionalWhatsApp } from "@/lib/zindua";
import type { CurrencyCode } from "@/prisma/generated/prisma/client";

const APP_NAME = process.env.APP_NAME?.trim() || "Klambocore";

export type PayrollNotifyStatus = "ABSENT" | "LATE" | "EARLY_EXIT";

function payrollStatusKey(status: PayrollNotifyStatus) {
  if (status === "ABSENT") return "payroll.statusAbsent";
  if (status === "EARLY_EXIT") return "payroll.statusEarlyExit";
  return "payroll.statusLate";
}

function payrollRuleKey(
  status: PayrollNotifyStatus,
  cycle: "SECONDAIRE" | "PRIMAIRE" | "MATERNELLE",
) {
  if (status === "ABSENT") {
    return cycle === "SECONDAIRE"
      ? "payroll.ruleAbsentSecondary"
      : "payroll.ruleAbsentPrimary";
  }
  if (status === "EARLY_EXIT") return "payroll.ruleEarlyExit";
  return "payroll.ruleLate";
}

export async function sendPayrollDeductionEmail(input: {
  to?: string | null;
  phone?: string | null;
  recipientName: string;
  branchName: string;
  contextLabel: string;
  occurredOn: Date;
  status: PayrollNotifyStatus;
  deduction: number;
  currency: CurrencyCode;
  graceMinutes?: number;
  cycle?: "SECONDAIRE" | "PRIMAIRE" | "MATERNELLE";
  organizationId?: string | null;
  branchId?: string | null;
  locale?: MessagingLocale | null;
}) {
  const email = input.to?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  if (!email && !phone) return;

  const locale = await resolveSenderMessagingLocale({
    locale: input.locale,
    branchId: input.branchId,
  });
  const t = await getMessagingTranslator(locale);
  const statusLabel = t(payrollStatusKey(input.status));
  const rule = t(
    payrollRuleKey(input.status, input.cycle ?? "SECONDAIRE"),
    { grace: input.graceMinutes ?? 5 },
  );
  const amount = `${input.deduction.toLocaleString(intlLocaleFromUserLocale(locale))} ${CURRENCY_LABELS[input.currency]}`;
  const date = formatMessagingDate(input.occurredOn, locale);
  const hello = formatMessagingHello(t, input.recipientName);
  const intro = `${hello} ${t("payroll.intro")}`.trim();
  const subject = t("payroll.subject", { status: statusLabel });
  const rows = [
    { label: t("common.school"), value: input.branchName },
    { label: t("common.session"), value: input.contextLabel },
    { label: t("common.date"), value: date },
    { label: t("common.status"), value: statusLabel },
    { label: t("payroll.estimatedDeduction"), value: amount },
    { label: t("common.rule"), value: rule },
  ];

  const text = [
    intro,
    "",
    t("payroll.impactLine", { status: statusLabel }),
    ...rows.map((row) => `${row.label} : ${row.value}`),
    "",
    t("payroll.footer"),
  ].join("\n");

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: t("payroll.title"),
    intro: escapeHtml(intro),
    bodyHtml: emailInfoCard(
      rows.map((row) => ({
        label: row.label,
        valueHtml: escapeHtml(row.value),
      })),
    ),
    footerNote: t("payroll.footer"),
  });

  if (email) {
    await sendMail({
      to: email,
      subject,
      text,
      html,
      organizationId: input.organizationId,
      notificationEvent: "payroll",
      locale,
      whatsappTo: null,
    });
  }

  if (phone) {
    const { parts, richBody } = prepareNotifyDelivery({
      tone: "amber",
      brand: input.branchName || APP_NAME,
      title: t("payroll.title"),
      intro,
      rows: rows.map((row) => ({
        label: row.label,
        value: row.value,
        ...(row.label === t("payroll.estimatedDeduction")
          ? { kind: "highlight" as const }
          : {}),
      })),
      note: t("payroll.footer"),
      omitBrandRow: true,
    });
    await sendTransactionalWhatsApp({
      to: phone,
      organizationId: input.organizationId,
      branchId: input.branchId,
      locale,
      queueKind: "finance",
      parts,
      richBody,
    });
  }
}
