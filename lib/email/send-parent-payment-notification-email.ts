import { resolveNotificationChannels } from "@/lib/notification-channels";
import {
  getMessagingTranslator,
  resolveSenderMessagingLocale,
  type MessagingLocale,
} from "@/lib/messaging-locale";
import { sendMail } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  escapeHtml,
  getSignInUrl,
} from "./email-layout";
import { sendTransactionalWhatsApp } from "@/lib/zindua";

const APP_NAME = DEFAULT_APP_NAME;

export type ParentPaymentNotifyKind = "created" | "updated" | "deleted";

export async function sendParentPaymentNotificationEmail(input: {
  to?: string | null;
  phone?: string | null;
  parentName: string;
  schoolName: string;
  kind: ParentPaymentNotifyKind;
  reference: string;
  amountLabel: string;
  studentNames: string;
  feeNames?: string;
  organizationId?: string | null;
  branchId?: string | null;
  locale?: MessagingLocale | null;
}): Promise<void> {
  const email = input.to?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  if (!email && !phone) return;

  const allow = await resolveNotificationChannels(
    input.organizationId,
    "payment",
  );
  if (!allow.email && !allow.whatsapp) return;

  const locale = await resolveSenderMessagingLocale({
    locale: input.locale,
    branchId: input.branchId,
  });
  const t = await getMessagingTranslator(locale);
  const copy = {
    title: t(`payment.${input.kind}.title`),
    intro: t(`payment.${input.kind}.intro`),
    subject: t(`payment.${input.kind}.subject`),
  };
  const subject = t("payment.subjectLine", {
    app: APP_NAME,
    subject: copy.subject,
  });
  const intro = t("payment.introHello", {
    name: input.parentName,
    intro: copy.intro,
  });
  const rows = [
    { label: t("common.school"), value: input.schoolName },
    { label: t("common.reference"), value: input.reference },
    { label: t("common.amount"), value: input.amountLabel },
    {
      label: t("common.students"),
      value: input.studentNames || "—",
    },
    ...(input.feeNames
      ? [{ label: t("common.fees"), value: input.feeNames }]
      : []),
  ];

  const text = [
    intro,
    "",
    ...rows.map((row) => `${row.label} : ${row.value}`),
    "",
    t("common.connectHint"),
    "",
    t("common.signatureApp", { app: APP_NAME }),
  ].join("\n");

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: copy.title,
    intro: escapeHtml(intro),
    bodyHtml: emailInfoCard(
      rows.map((row) => ({
        label: row.label,
        valueHtml: escapeHtml(row.value),
      })),
    ),
    cta: {
      href: getSignInUrl(),
      label: t("common.openAccount"),
    },
  });

  if (allow.email && email) {
    await sendMail({
      to: email,
      organizationId: input.organizationId,
      notificationEvent: "payment",
      subject,
      text,
      html,
    });
  }

  if (allow.whatsapp && phone) {
    await sendTransactionalWhatsApp({
      to: phone,
      organizationId: input.organizationId,
      locale,
      queueKind: "payment",
      parts: [
        input.schoolName,
        t("common.hello", { name: input.parentName }),
        copy.intro,
        `${t("common.reference")} : ${input.reference}.`,
        `${t("common.amount")} : ${input.amountLabel}.`,
        input.studentNames
          ? `${t("common.students")} : ${input.studentNames}.`
          : null,
        input.feeNames ? `${t("common.fees")} : ${input.feeNames}.` : null,
        t("common.detailUrl", { url: getSignInUrl() }),
        t("common.signatureApp", {
          app: input.schoolName || APP_NAME,
        }),
      ],
    });
  }
}
