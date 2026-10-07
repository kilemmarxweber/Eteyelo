import {
  dayGreetingMessageKey,
  getMessagingTranslator,
  resolveMessagingLocaleForUser,
  resolveDayGreetingPeriod,
  type MessagingLocale,
} from "@/lib/messaging-locale";
import { sendMail } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailLayoutHtml,
  escapeHtml,
} from "./email-layout";

const APP_NAME = DEFAULT_APP_NAME;

export async function sendVerificationEmail(input: {
  to: string;
  phone?: string | null;
  url: string;
  name?: string;
  subject?: string;
  organizationId?: string | null;
  userLocale?: MessagingLocale | null;
}): Promise<void> {
  const locale = resolveMessagingLocaleForUser({
    branch: null,
    userLocale: input.userLocale,
  });
  const t = await getMessagingTranslator(locale);
  const greeting = t(dayGreetingMessageKey(resolveDayGreetingPeriod()));
  const hello = input.name?.trim()
    ? t("common.hello", { greeting, name: input.name.trim() })
    : t("common.helloBare", { greeting });
  const subject =
    input.subject ?? t("emailVerification.subject", { app: APP_NAME });
  const introText = `${hello} ${t("emailVerification.intro", { app: APP_NAME })}`.trim();

  const text = [
    hello,
    "",
    t("emailVerification.linkHint"),
    input.url,
    "",
    t("common.ignoreIfUnexpected"),
    "",
    t("common.signatureTeam", { app: APP_NAME }),
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
      ${escapeHtml(t("common.ignoreIfUnexpected"))}
    </p>
  `;

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: t("emailVerification.title"),
    intro: escapeHtml(introText),
    bodyHtml,
    cta: { href: input.url, label: t("emailVerification.cta") },
  });

  try {
    await sendMail({
      to: input.to,
      whatsappTo: input.phone,
      whatsappName: input.name,
      organizationId: input.organizationId,
      notificationEvent: "emailVerification",
      locale,
      subject,
      text,
      html,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Nodemailer: ${message}`);
  }
}
