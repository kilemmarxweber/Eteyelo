import { orgRoleLabel } from "@/lib/org-role-labels";
import {
  dayGreetingMessageKey,
  getMessagingTranslator,
  resolveDayGreetingPeriod,
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

function getAcceptInvitationUrl(invitationId: string): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  return `${base}/accept-invitation?invitationId=${encodeURIComponent(invitationId)}`;
}

export async function sendOrganizationInvitationEmail(input: {
  to: string;
  invitationId: string;
  organizationName: string;
  role: string;
  inviterName?: string | null;
  organizationId?: string | null;
  branchId?: string | null;
  locale?: MessagingLocale | null;
}): Promise<void> {
  const acceptUrl = getAcceptInvitationUrl(input.invitationId);
  const locale = await resolveSenderMessagingLocale({
    locale: input.locale,
    branchId: input.branchId,
  });
  const t = await getMessagingTranslator(locale);
  const roleLabel = orgRoleLabel(input.role);
  const inviter =
    input.inviterName?.trim() || t("invitation.defaultInviter");
  const greeting = t(dayGreetingMessageKey(resolveDayGreetingPeriod()));
  const hello = t("common.helloBare", { greeting });
  const subject = t("invitation.subject", {
    app: APP_NAME,
    org: input.organizationName,
  });
  const introText = t("invitation.intro", {
    inviter,
    org: input.organizationName,
    app: APP_NAME,
    role: roleLabel,
  });

  const text = [
    hello,
    "",
    introText,
    "",
    `${t("common.organization")} : ${input.organizationName}`,
    `${t("common.role")} : ${roleLabel}`,
    "",
    t("invitation.acceptUrl", { url: acceptUrl }),
    "",
    t("invitation.ignore"),
    "",
    t("common.signatureTeam", { app: APP_NAME }),
  ].join("\n");

  const bodyHtml = `
    ${emailInfoCard([
      {
        label: t("common.organization"),
        valueHtml: escapeHtml(input.organizationName),
      },
      { label: t("common.role"), valueHtml: escapeHtml(roleLabel) },
      { label: t("common.email"), valueHtml: escapeHtml(input.to) },
    ])}
    <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#64748b;">
      ${escapeHtml(t("invitation.scopeNote"))}
    </p>
    <p style="margin:12px 0 0;font-size:14px;line-height:1.7;color:#64748b;">
      ${escapeHtml(t("common.ignoreIfUnexpected"))}
    </p>
  `;

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: t("invitation.title"),
    intro: escapeHtml(`${hello} ${introText}`.trim()),
    bodyHtml,
    cta: { href: acceptUrl, label: t("invitation.accept") },
  });

  if (isSmtpConfigured()) {
    try {
      await sendMail({
        to: input.to,
        subject,
        text,
        html,
        organizationId: input.organizationId,
        notificationEvent: "invitation",
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
      `[sendOrganizationInvitationEmail] to=${input.to} url=${acceptUrl}`,
    );
    return;
  }

  // eslint-disable-next-line no-console
  console.warn(
    "[sendOrganizationInvitationEmail] SMTP non configuré : email non envoyé.",
  );
}
