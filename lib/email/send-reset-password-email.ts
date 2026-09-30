import { sendMail } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  escapeHtml,
  getSignInUrl,
} from "./email-layout";
import { sendResetPasswordWhatsApp } from "@/lib/zindua";
import { resolveNotificationChannels } from "@/lib/notification-channels";
import { isWhatsAppSendingEnabled } from "@/lib/whatsapp-settings";
import {
  getMessagingTranslator,
  resolveSenderMessagingLocale,
  type MessagingLocale,
} from "@/lib/messaging-locale";

const APP_NAME = DEFAULT_APP_NAME;

export async function sendResetPasswordEmail(input: {
  to: string;
  phone?: string | null;
  name: string;
  temporaryPassword: string;
  loginUrl?: string;
  branchName?: string | null;
  organizationId?: string | null;
  branchId?: string | null;
  locale?: MessagingLocale | null;
}): Promise<{ emailSent: boolean; whatsappSent: boolean; whatsappError?: string }> {
  const { to, name, temporaryPassword } = input;
  const allow = await resolveNotificationChannels(
    input.organizationId,
    "passwordReset",
  );
  if (!allow.email && !allow.whatsapp) {
    return { emailSent: false, whatsappSent: false };
  }

  const locale = await resolveSenderMessagingLocale({
    locale: input.locale,
    branchId: input.branchId,
  });
  const t = await getMessagingTranslator(locale);
  const loginUrl = input.loginUrl ?? getSignInUrl();

  const subject = t("passwordReset.subject", { app: APP_NAME });
  const introText = t("passwordReset.intro", { name, app: APP_NAME });

  const text = [
    t("common.helloPlain", { name }),
    "",
    t("passwordReset.bodyLead"),
    "",
    `${t("common.email")} : ${to}`,
    `${t("common.newPassword")} : ${temporaryPassword}`,
    "",
    t("common.connectHere", { url: loginUrl }),
    "",
    t("passwordReset.securityNote"),
    "",
    t("common.signatureTeam", { app: APP_NAME }),
  ].join("\n");

  const bodyHtml = `
    ${emailInfoCard([
      { label: t("common.email"), valueHtml: escapeHtml(to) },
      {
        label: t("common.newPassword"),
        valueHtml: `<code style="background:#e2e8f0;padding:2px 8px;border-radius:6px;font-size:13px;">${escapeHtml(temporaryPassword)}</code>`,
      },
      {
        label: t("common.login"),
        valueHtml: `<a href="${escapeHtml(loginUrl)}" style="color:#1d4ed8;text-decoration:none;">klambocore.com</a>`,
      },
    ])}
    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
      ${escapeHtml(t("passwordReset.securityNoteHtml"))}
    </p>
  `;

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: t("passwordReset.title"),
    intro: escapeHtml(introText),
    bodyHtml,
    cta: { href: loginUrl, label: t("common.signInKlambo") },
  });

  const phone = input.phone?.trim();

  const emailTask = allow.email
    ? sendMail({
        to,
        organizationId: input.organizationId,
        notificationEvent: "passwordReset",
        subject,
        text,
        html,
      }).then(() => true as const)
    : Promise.resolve(false as const);

  const waTask =
    allow.whatsapp && phone
      ? sendResetPasswordWhatsApp({
          to: phone,
          name,
          temporaryPassword,
          email: to,
          loginUrl,
          branchName: input.branchName,
          organizationId: input.organizationId,
          locale,
        })
      : Promise.resolve(null);

  const [emailOk, wa] = await Promise.all([emailTask, waTask]);

  let whatsappSent = false;
  let whatsappError: string | undefined;
  if (wa) {
    whatsappSent = wa.sent;
    whatsappError = wa.error;
  } else if (phone && !allow.whatsapp) {
    const sending = await isWhatsAppSendingEnabled(input.organizationId);
    whatsappError = sending
      ? "WhatsApp est désactivé pour la réinitialisation (Notifications)."
      : "Envoi WhatsApp désactivé. Activez le commutateur (Message WhatsApp) et enregistrez.";
  }

  return {
    emailSent: allow.email && emailOk,
    whatsappSent,
    whatsappError,
  };
}
