import {
  formatMessagingHello,
  getMessagingTranslator,
  resolveMessagingLocaleForUser,
  resolveSenderMessagingLocale,
  type MessagingLocale,
} from "@/lib/messaging-locale";
import { sendMail } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailLayoutHtml,
  escapeHtml,
  getSignInUrl,
} from "./email-layout";

const APP_NAME = DEFAULT_APP_NAME;

export async function sendProfileUpdatedEmail(input: {
  to: string;
  phone?: string | null;
  name: string;
  organizationId?: string | null;
  branchId?: string | null;
  userLocale?: MessagingLocale | null;
}) {
  const locale = input.branchId
    ? await resolveSenderMessagingLocale({
        locale: input.userLocale,
        branchId: input.branchId,
      })
    : resolveMessagingLocaleForUser({
        branch: null,
        userLocale: input.userLocale,
      });

  const t = await getMessagingTranslator(locale);
  const hello = formatMessagingHello(t, input.name);
  const subject = t("profileUpdate.subject", { app: APP_NAME });
  const introText = `${hello} ${t("profileUpdate.intro", { app: APP_NAME })}`.trim();
  const loginUrl = getSignInUrl();

  const text = [
    hello,
    "",
    t("profileUpdate.body"),
    "",
    t("profileUpdate.security"),
    "",
    t("common.signatureTeam", { app: APP_NAME }),
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
      ${escapeHtml(t("profileUpdate.hint"))}
    </p>
  `;

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: t("profileUpdate.title"),
    intro: escapeHtml(introText),
    bodyHtml,
    cta: { href: loginUrl, label: t("profileUpdate.cta") },
  });

  await sendMail({
    to: input.to,
    whatsappTo: input.phone,
    whatsappName: input.name,
    organizationId: input.organizationId,
    notificationEvent: "profileUpdate",
    locale,
    subject,
    text,
    html,
  });
}
