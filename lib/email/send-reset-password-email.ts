import { sendMail } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  emailSecretValue,
  escapeHtml,
  getSignInUrl,
} from "./email-layout";
import { sendResetPasswordWhatsApp } from "@/lib/zindua";
import { resolveNotificationChannels } from "@/lib/notification-channels";
import { isMessagingNotifyEnabled } from "@/lib/whatsapp-settings";
import {
  formatMessagingHelloPlain,
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
}): Promise<{
  emailSent: boolean;
  whatsappSent: boolean;
  whatsappError?: string;
  mobileChannel?: "klambo" | "whatsapp" | "none";
}> {
  const { to, name, temporaryPassword } = input;
  const allow = await resolveNotificationChannels(
    input.organizationId,
    "passwordReset",
  );
  if (!allow.email && !allow.whatsapp) {
    return { emailSent: false, whatsappSent: false, mobileChannel: "none" };
  }

  const locale = await resolveSenderMessagingLocale({
    locale: input.locale,
    branchId: input.branchId,
  });
  const t = await getMessagingTranslator(locale);
  const loginUrl = input.loginUrl ?? getSignInUrl();

  const subject = t("passwordReset.subject", { app: APP_NAME });
  const helloPlain = formatMessagingHelloPlain(t, name);
  const introText = `${helloPlain}, ${t("passwordReset.intro", { app: APP_NAME })}`;

  const text = [
    helloPlain,
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
        valueHtml: emailSecretValue(temporaryPassword),
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
          branchId: input.branchId,
          locale,
        })
      : Promise.resolve(null);

  const [emailOk, wa] = await Promise.all([emailTask, waTask]);

  let whatsappSent = false;
  let whatsappError: string | undefined;
  let mobileChannel: "klambo" | "whatsapp" | "none" | undefined;
  if (wa) {
    whatsappSent = wa.sent;
    whatsappError = wa.error;
    mobileChannel = wa.channel ?? (wa.sent ? "whatsapp" : "none");
  } else if (phone && !allow.whatsapp) {
    const sending = await isMessagingNotifyEnabled(input.organizationId);
    whatsappError = sending
      ? "Canal mobile désactivé pour la réinitialisation (Notifications)."
      : "Canal mobile désactivé (Klambo Inbox ou WhatsApp). Activez-le dans Paramètres → Message WhatsApp / Notifications.";
    mobileChannel = "none";
  }

  return {
    emailSent: allow.email && emailOk,
    whatsappSent,
    whatsappError,
    mobileChannel,
  };
}
