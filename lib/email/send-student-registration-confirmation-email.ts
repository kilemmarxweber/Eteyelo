import { resolveNotificationChannels } from "@/lib/notification-channels";
import {
  formatMessagingHello,
  getMessagingTranslator,
  resolveSenderMessagingLocale,
  type MessagingLocale,
} from "@/lib/messaging-locale";
import { sendTransactionalWhatsApp } from "@/lib/zindua";
import { prepareNotifyDelivery } from "@/lib/notify/notify-message-card";
import { sendMail } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  escapeHtml,
  getSignInUrl,
} from "./email-layout";

const APP_NAME = DEFAULT_APP_NAME;

export async function sendStudentRegistrationConfirmationEmail(input: {
  to: string;
  /** Téléphone parent/élève pour miroir WhatsApp / inbox. */
  phone?: string | null;
  recipientName: string;
  studentName: string;
  reference: string;
  branchName: string;
  requestedLevel?: string | null;
  organizationId?: string | null;
  branchId?: string | null;
  locale?: MessagingLocale | null;
}): Promise<void> {
  const email = input.to?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  if (!email && !phone) return;

  const allow = await resolveNotificationChannels(
    input.organizationId,
    "inscription",
  );
  if (!allow.email && !allow.whatsapp) return;

  const locale = await resolveSenderMessagingLocale({
    locale: input.locale,
    branchId: input.branchId,
  });
  const t = await getMessagingTranslator(locale);
  const level = input.requestedLevel?.trim() || "—";
  const hello = formatMessagingHello(t, input.recipientName);
  const introBody = t("inscription.intro");
  const intro = `${hello} ${introBody}`.trim();
  const subject = `${t("inscription.subject", { app: APP_NAME })} (${input.reference})`;
  const title = t("inscription.title");
  const note = t("inscription.note");

  const rows = [
    { label: t("common.reference"), value: input.reference },
    { label: t("common.student"), value: input.studentName },
    { label: t("common.school"), value: input.branchName },
    { label: t("common.class"), value: level },
  ];

  const text = [
    intro,
    "",
    ...rows.map((row) => `${row.label} : ${row.value}`),
    "",
    note,
    "",
    `klambocore.com`,
  ].join("\n");

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title,
    intro: escapeHtml(intro),
    bodyHtml: `
      ${emailInfoCard(
        rows.map((row) => ({
          label: row.label,
          valueHtml: escapeHtml(row.value),
        })),
      )}
      <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
        ${escapeHtml(note)}
      </p>
    `,
  });

  if (allow.email && email) {
    try {
      await sendMail({
        to: email,
        organizationId: input.organizationId,
        notificationEvent: "inscription",
        subject,
        text,
        html,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Nodemailer: ${message}`);
    }
  }

  if (allow.whatsapp && phone) {
    const { parts, richBody } = prepareNotifyDelivery({
      tone: "navy",
      brand: input.branchName || APP_NAME,
      title,
      intro,
      rows,
      note,
      cta: {
        label: t("common.openAccount"),
        href: getSignInUrl(),
      },
      omitBrandRow: true,
    });
    await sendTransactionalWhatsApp({
      to: phone,
      organizationId: input.organizationId,
      locale,
      branchId: input.branchId,
      queueKind: "other",
      parts,
      richBody,
    });
  }
}
