import {
  formatMessagingHello,
  getMessagingTranslator,
  resolveSenderMessagingLocale,
  type MessagingLocale,
} from "@/lib/messaging-locale";
import { sendMail, isSmtpConfigured } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  escapeHtml,
} from "./email-layout";

const APP_NAME = DEFAULT_APP_NAME;

export async function sendJobApplicationConfirmationEmail(input: {
  to: string;
  candidateName: string;
  reference: string;
  applicationType: "TEACHER" | "PERSONNEL";
  branchName: string;
  organizationId?: string | null;
  branchId?: string | null;
  locale?: MessagingLocale | null;
}): Promise<void> {
  const locale = await resolveSenderMessagingLocale({
    locale: input.locale,
    branchId: input.branchId,
  });
  const t = await getMessagingTranslator(locale);
  const roleLabel =
    input.applicationType === "TEACHER"
      ? t("common.teacher")
      : t("common.staff");
  const hello = formatMessagingHello(t, input.candidateName);
  const subject = t("jobApplication.subject", {
    app: APP_NAME,
    reference: input.reference,
  });
  const introText = `${hello} ${t("jobApplication.intro", {
    role: roleLabel.toLowerCase(),
    school: input.branchName,
    reference: input.reference,
  })}`.trim();

  const text = [
    hello,
    "",
    t("jobApplication.bodyLead"),
    "",
    `${t("common.reference")} : ${input.reference}`,
    `${t("jobApplication.jobType")} : ${roleLabel}`,
    `${t("common.school")} : ${input.branchName}`,
    "",
    t("jobApplication.note"),
    "",
    `klambocore.com`,
  ].join("\n");

  const bodyHtml = `
    ${emailInfoCard([
      {
        label: t("common.reference"),
        valueHtml: escapeHtml(input.reference),
      },
      {
        label: t("jobApplication.jobType"),
        valueHtml: escapeHtml(roleLabel),
      },
      {
        label: t("common.school"),
        valueHtml: escapeHtml(input.branchName),
      },
    ])}
    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
      ${escapeHtml(t("jobApplication.note"))}
    </p>
  `;

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: t("jobApplication.title"),
    intro: escapeHtml(introText),
    bodyHtml,
  });

  if (isSmtpConfigured()) {
    try {
      await sendMail({
        to: input.to,
        subject,
        text,
        html,
        organizationId: input.organizationId,
        locale,
      });
      return;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Nodemailer: ${message}`);
    }
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.info(
      `[sendJobApplicationConfirmationEmail] to=${input.to} ref=${input.reference}`,
    );
    return;
  }

  // eslint-disable-next-line no-console
  console.warn(
    "[sendJobApplicationConfirmationEmail] SMTP non configuré : email non envoyé.",
  );
}
