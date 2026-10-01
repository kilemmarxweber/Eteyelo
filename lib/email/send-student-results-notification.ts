import { resolveNotificationChannels } from "@/lib/notification-channels";
import {
  formatMessagingHello,
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
import {
  notifyCardToWhatsAppParts,
  serializeNotifyCard,
} from "@/lib/notify/notify-message-card";

const APP_NAME = DEFAULT_APP_NAME;
const MAX_SUBJECT_LINES = 8;

export type StudentResultLine = {
  subject: string;
  score: number;
  maxScore: number;
};

export async function sendStudentResultsNotification(input: {
  to?: string | null;
  phone?: string | null;
  parentName: string;
  studentName: string;
  schoolName: string;
  className?: string | null;
  periodLabel: string;
  yearLabel: string;
  lines: StudentResultLine[];
  percentage: number;
  organizationId?: string | null;
  branchId?: string | null;
  locale?: MessagingLocale | null;
}): Promise<{
  emailSent: boolean;
  whatsappSent: boolean;
  whatsappError?: string;
  mobileChannel?: "klambo" | "whatsapp" | "none";
}> {
  const email = input.to?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  if (!email && !phone) {
    return { emailSent: false, whatsappSent: false, mobileChannel: "none" };
  }

  const allow = await resolveNotificationChannels(
    input.organizationId,
    "results",
  );
  if (!allow.email && !allow.whatsapp) {
    return { emailSent: false, whatsappSent: false, mobileChannel: "none" };
  }

  const locale = await resolveSenderMessagingLocale({
    locale: input.locale,
    branchId: input.branchId,
  });
  const t = await getMessagingTranslator(locale);

  const averageLabel = `${input.percentage.toFixed(1)}%`;
  const shown = input.lines.slice(0, MAX_SUBJECT_LINES);
  const extra = input.lines.length - shown.length;
  const subjectRows = shown.map((line) => ({
    label: line.subject,
    value: `${line.score}/${line.maxScore}`,
  }));
  if (extra > 0) {
    subjectRows.push({
      label: t("common.otherSubjects"),
      value: t("common.otherSubjectsValue", { count: extra }),
    });
  }

  const classSuffix = input.className
    ? t("results.classSuffix", { className: input.className })
    : "";
  const subject = t("results.subject", {
    app: APP_NAME,
    student: input.studentName,
  });
  const hello = formatMessagingHello(t, input.parentName);
  const introBody = t("results.intro", {
    student: input.studentName,
    classSuffix,
    period: input.periodLabel,
    year: input.yearLabel,
  });
  const intro = `${hello} ${introBody}`;

  const rows = [
    { label: t("common.school"), value: input.schoolName },
    { label: t("common.student"), value: input.studentName },
    ...(input.className
      ? [{ label: t("common.class"), value: input.className }]
      : []),
    {
      label: t("common.period"),
      value: `${input.periodLabel} — ${input.yearLabel}`,
    },
    ...subjectRows,
    { label: t("common.average"), value: averageLabel },
  ];

  const text = [
    intro,
    "",
    ...rows.map((row) => `${row.label} : ${row.value}`),
    "",
    t("common.connectHere", { url: getSignInUrl() }),
    "",
    t("common.signatureApp", { app: input.schoolName || APP_NAME }),
  ].join("\n");

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: t("results.title"),
    intro: escapeHtml(intro),
    bodyHtml: emailInfoCard(
      rows.map((row) => ({
        label: row.label,
        valueHtml: escapeHtml(row.value),
      })),
    ),
    cta: { href: getSignInUrl(), label: t("common.openAccount") },
  });

  if (allow.email && email) {
    await sendMail({
      to: email,
      organizationId: input.organizationId,
      notificationEvent: "results",
      subject,
      text,
      html,
    });
  }

  let whatsappSent = false;
  let whatsappError: string | undefined;
  let mobileChannel: "klambo" | "whatsapp" | "none" | undefined;
  if (allow.whatsapp && phone) {
    const loginUrl = getSignInUrl();
    const card = {
      v: 1 as const,
      tone: "navy" as const,
      brand: input.schoolName || APP_NAME,
      title: t("results.title"),
      intro,
      rows: [
        { label: t("common.student"), value: input.studentName },
        ...(input.className
          ? [{ label: t("common.class"), value: input.className }]
          : []),
        {
          label: t("common.period"),
          value: `${input.periodLabel} — ${input.yearLabel}`,
        },
        ...shown.map((line) => ({
          label: line.subject,
          value: `${line.score}/${line.maxScore}`,
        })),
        ...(extra > 0
          ? [
              {
                label: t("common.otherSubjects"),
                value: t("common.otherSubjectsValue", { count: extra }),
              },
            ]
          : []),
        {
          label: t("common.average"),
          value: averageLabel,
        },
      ],
      cta: {
        label: t("common.openAccount"),
        href: loginUrl,
      },
    };
    const wa = await sendTransactionalWhatsApp({
      to: phone,
      organizationId: input.organizationId,
      locale,
      branchId: input.branchId,
      queueKind: "results",
      parts: [
        ...notifyCardToWhatsAppParts(card),
        t("common.signatureApp", {
          app: input.schoolName || APP_NAME,
        }),
      ],
      richBody: serializeNotifyCard(card),
    });
    whatsappSent = wa.sent;
    whatsappError = wa.error;
    mobileChannel = wa.channel ?? (wa.sent ? "whatsapp" : "none");
  }

  return {
    emailSent: Boolean(allow.email && email),
    whatsappSent,
    whatsappError,
    mobileChannel,
  };
}
