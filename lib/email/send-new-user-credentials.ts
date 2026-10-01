import { isDeliverableMailbox } from "./deliverable-mailbox";
import { sendMail } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  emailSecretValue,
  escapeHtml,
  getSignInUrl,
} from "./email-layout";
import { sendNewUserCredentialsWhatsApp } from "@/lib/zindua";
import { resolveNotificationChannels } from "@/lib/notification-channels";
import {
  formatMessagingHelloPlain,
  getMessagingTranslator,
  resolveSenderMessagingLocale,
  type MessagingLocale,
} from "@/lib/messaging-locale";

const APP_NAME = DEFAULT_APP_NAME;

/**
 * Envoie les identifiants temporaires après création de compte (parent, élève, …).
 * Email SMTP + WhatsApp dédié (comme le reset MDP).
 */
export async function sendNewUserCredentialsEmail(input: {
  to: string;
  phone?: string | null;
  name: string;
  temporaryPassword: string;
  role?: string;
  organizationName?: string;
  branchName?: string;
  branchPhone?: string;
  branchAddress?: string;
  loginUrl?: string;
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
    "accountCreate",
  );
  if (!allow.email && !allow.whatsapp) {
    return { emailSent: false, whatsappSent: false, mobileChannel: "none" };
  }

  const locale = await resolveSenderMessagingLocale({
    locale: input.locale,
    branchId: input.branchId,
  });
  const t = await getMessagingTranslator(locale);

  const role = input.role?.trim() || t("common.defaultRole");
  const organizationName = input.organizationName?.trim();
  const branchName = input.branchName?.trim();
  const branchPhone = input.branchPhone?.trim();
  const branchAddress = input.branchAddress?.trim();
  const loginUrl = input.loginUrl ?? getSignInUrl();

  const contextParts = [
    t("accountCreate.contextRole", { role }),
    organizationName
      ? t("accountCreate.contextOrg", { org: organizationName })
      : null,
    branchName
      ? t("accountCreate.contextBranch", { branch: branchName })
      : null,
  ].filter(Boolean);
  const context = contextParts.join(", ");

  const subject = t("accountCreate.subject", { app: APP_NAME });
  const helloPlain = formatMessagingHelloPlain(t, name);
  const introText = `${helloPlain}, ${t("accountCreate.intro", {
    app: APP_NAME,
    context,
  })}`;

  const text = [
    helloPlain,
    "",
    t("accountCreate.bodyLead", { app: APP_NAME, context }),
    "",
    `${t("common.email")} : ${to}`,
    `${t("common.role")} : ${role}`,
    ...(organizationName
      ? [`${t("common.organization")} : ${organizationName}`]
      : []),
    ...(branchName ? [`${t("common.branch")} : ${branchName}`] : []),
    ...(branchPhone
      ? [`${t("common.branchPhone")} : ${branchPhone}`]
      : []),
    ...(branchAddress ? [`Adresse branche : ${branchAddress}`] : []),
    `${t("common.temporaryPassword")} : ${temporaryPassword}`,
    "",
    t("common.connectHere", { url: loginUrl }),
    "",
    t("accountCreate.securityNote"),
    "",
    t("common.signatureTeam", { app: APP_NAME }),
  ].join("\n");

  const infoRows = [
    { label: t("common.email"), valueHtml: escapeHtml(to) },
    { label: t("common.role"), valueHtml: escapeHtml(role) },
    ...(organizationName
      ? [
          {
            label: t("common.organization"),
            valueHtml: escapeHtml(organizationName),
          },
        ]
      : []),
    ...(branchName
      ? [{ label: t("common.branch"), valueHtml: escapeHtml(branchName) }]
      : []),
    ...(branchPhone
      ? [
          {
            label: t("common.branchPhone"),
            valueHtml: `<a href="tel:${escapeHtml(branchPhone)}" style="color:#1d4ed8;text-decoration:none;">${escapeHtml(branchPhone)}</a>`,
          },
        ]
      : []),
    {
      label: t("common.temporaryPassword"),
      valueHtml: emailSecretValue(temporaryPassword),
    },
    {
      label: t("common.login"),
      valueHtml: `<a href="${escapeHtml(loginUrl)}" style="color:#1d4ed8;text-decoration:none;">klambocore.com</a>`,
    },
  ];

  const bodyHtml = `
    ${emailInfoCard(infoRows)}
    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
      ${escapeHtml(t("accountCreate.securityNote"))}
    </p>
  `;

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: t("accountCreate.title"),
    intro: escapeHtml(introText),
    bodyHtml,
    cta: { href: loginUrl, label: t("common.signInKlambo") },
    branchContact: {
      name: branchName,
      phone: branchPhone,
      address: branchAddress,
    },
  });

  if (allow.email) {
    await sendMail({
      to,
      organizationId: input.organizationId,
      notificationEvent: "accountCreate",
      subject,
      text,
      html,
    });
  }

  let whatsappSent = false;
  let whatsappError: string | undefined;
  let mobileChannel: "klambo" | "whatsapp" | "none" | undefined;
  if (allow.whatsapp && input.phone?.trim()) {
    const wa = await sendNewUserCredentialsWhatsApp({
      to: input.phone,
      name,
      email: to,
      temporaryPassword,
      role,
      organizationName,
      branchName,
      loginUrl,
      organizationId: input.organizationId,
      branchId: input.branchId,
      locale,
    });
    whatsappSent = wa.sent;
    whatsappError = wa.error;
    mobileChannel = wa.channel ?? (wa.sent ? "whatsapp" : "none");
  }

  return {
    emailSent: allow.email && isDeliverableMailbox(to),
    whatsappSent,
    whatsappError,
    mobileChannel,
  };
}
