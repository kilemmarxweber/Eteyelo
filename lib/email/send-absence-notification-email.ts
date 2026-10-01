import { resolveNotificationChannels } from "@/lib/notification-channels";
import {
  formatMessagingDate,
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
import { prepareNotifyDelivery } from "@/lib/notify/notify-message-card";

const APP_NAME = DEFAULT_APP_NAME;

type AbsenceEmailKind =
  | "absence"
  | "justification_submitted"
  | "justification_received"
  | "accepted"
  | "rejected"
  | "return";

function absenceTone(
  kind: AbsenceEmailKind,
): "rose" | "emerald" | "amber" | "navy" {
  if (kind === "accepted" || kind === "return") return "emerald";
  if (kind === "rejected") return "amber";
  return "rose";
}

async function sendAbsenceMail(input: {
  to?: string | null;
  phone?: string | null;
  recipientName: string;
  subject: string;
  title: string;
  /** Corps sans salutation (une seule salutation dynamique est ajoutée). */
  introBody: string;
  rows: Array<{ label: string; value: string }>;
  note?: string;
  ctaLabel?: string;
  organizationId?: string | null;
  branchId?: string | null;
  locale: MessagingLocale;
  schoolLabel: string;
  kind: AbsenceEmailKind;
  brand?: string;
}): Promise<void> {
  const email = input.to?.trim();
  if (!email && !input.phone) return;

  const allow = await resolveNotificationChannels(
    input.organizationId,
    "attendance",
  );
  if (!allow.email && !allow.whatsapp) return;

  const t = await getMessagingTranslator(input.locale);
  const hello = formatMessagingHello(t, input.recipientName);
  const intro = `${hello} ${input.introBody}`.trim();
  const loginUrl = getSignInUrl();

  const text = [
    intro,
    "",
    ...input.rows.map((row) => `${row.label} : ${row.value}`),
    input.note ? `\n${input.note}` : "",
    "",
    `klambocore.com`,
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  const bodyHtml = `
    ${emailInfoCard(
      input.rows.map((row) => ({
        label: row.label,
        valueHtml: escapeHtml(row.value),
      })),
    )}
    ${
      input.note
        ? `<p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">${escapeHtml(input.note)}</p>`
        : ""
    }
  `;

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: input.title,
    intro: escapeHtml(intro),
    bodyHtml,
    cta: input.ctaLabel
      ? { href: loginUrl, label: input.ctaLabel }
      : undefined,
  });

  if (allow.email) {
    try {
      await sendMail({
        to: email || "",
        organizationId: input.organizationId,
        notificationEvent: "attendance",
        subject: input.subject,
        text,
        html,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[sendAbsenceNotificationEmail] ${message}`);
    }
  }

  if (allow.whatsapp && input.phone?.trim()) {
    const brand =
      input.brand ||
      input.rows.find((row) => row.label === input.schoolLabel)?.value ||
      APP_NAME;
    const { parts, richBody } = prepareNotifyDelivery({
      tone: absenceTone(input.kind),
      brand,
      title: input.title,
      intro,
      rows: input.rows,
      note: input.note,
      cta: input.ctaLabel
        ? { label: input.ctaLabel, href: loginUrl }
        : null,
      omitBrandRow: true,
    });

    await sendTransactionalWhatsApp({
      to: input.phone,
      organizationId: input.organizationId,
      branchId: input.branchId,
      locale: input.locale,
      queueKind: "absence",
      parts,
      richBody,
    });
  }
}

export type AbsenceEmailAudience = "subject" | "parent" | "reviewer";

export async function sendAbsenceLifecycleEmail(input: {
  kind: AbsenceEmailKind;
  to?: string | null;
  phone?: string | null;
  recipientName: string;
  personName: string;
  branchName: string;
  contextLabel: string;
  occurredOn: Date;
  subjectLabel: string;
  justification?: string | null;
  reviewComment?: string | null;
  organizationId?: string | null;
  branchId?: string | null;
  locale?: MessagingLocale | null;
  audience?: AbsenceEmailAudience;
}): Promise<void> {
  const locale = await resolveSenderMessagingLocale({
    locale: input.locale,
    branchId: input.branchId,
  });
  const t = await getMessagingTranslator(locale);
  const dateLabel = formatMessagingDate(input.occurredOn, locale);
  const schoolLabel = t("common.school");
  const rows = [
    { label: schoolLabel, value: input.branchName },
    { label: t("common.person"), value: input.personName },
    { label: t("common.quality"), value: input.subjectLabel },
    { label: t("common.date"), value: dateLabel },
    { label: t("common.session"), value: input.contextLabel },
  ];
  if (input.justification?.trim()) {
    rows.push({
      label: t("common.justification"),
      value: input.justification.trim(),
    });
  }
  if (input.reviewComment?.trim()) {
    rows.push({
      label: t("common.decision"),
      value: input.reviewComment.trim(),
    });
  }

  const forParent = input.audience === "parent";
  const base = `attendance.${input.kind}` as const;
  const introKey =
    forParent && input.kind !== "justification_received"
      ? (`${base}.introParent` as const)
      : (`${base}.intro` as const);

  const selected = {
    subject: t(`${base}.subject`, { app: APP_NAME }),
    title: t(`${base}.title`),
    introBody: t(introKey, {
      person: input.personName,
      school: input.branchName,
    }),
    note: t(`${base}.note`),
    cta: t(`${base}.cta`),
  };

  await sendAbsenceMail({
    to: input.to,
    phone: input.phone,
    recipientName: input.recipientName,
    subject: selected.subject,
    title: selected.title,
    introBody: selected.introBody,
    rows,
    note: selected.note,
    ctaLabel: selected.cta,
    organizationId: input.organizationId,
    branchId: input.branchId,
    locale,
    schoolLabel,
    kind: input.kind,
    brand: input.branchName,
  });
}
